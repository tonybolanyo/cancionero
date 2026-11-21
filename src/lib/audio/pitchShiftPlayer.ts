/**
 * Real-time Web Audio Pitch-Shifting, Time-Stretching, A-B Loop & EQ Isolation Player
 *
 * Supports:
 * 1. Real-time Pitch Shifting with Tempo Preservation (dual modulated delay lines in quadrature)
 * 2. Classic Resampling / Varispeed Pitch Shifting
 * 3. Independent Time-Stretching playback speed (0.6x – 1.25x)
 * 4. A-B Rehearsal Looping
 * 5. Real-time Mid-Side vocal attenuation (L-R) and frequency isolation (Bass <180Hz / Guitar 180-2800Hz)
 */

export type AudioEqMode = 'normal' | 'vocal_cut' | 'bass_isolate' | 'guitar_focus';

export interface PitchShiftPlayerOptions {
  preserveTempo?: boolean;
  semitones?: number;
  playbackRate?: number;
  eqMode?: AudioEqMode;
  volume?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  onStateChange?: (isPlaying: boolean) => void;
}

export class PitchShiftPlayer {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private pitchOutNode: GainNode | null = null;
  private gainNode: GainNode | null = null;

  // Real-time Pitch Shift DSP graph (Dual delay lines with sinusoidal crossfade)
  private delayNode1: DelayNode | null = null;
  private delayNode2: DelayNode | null = null;
  private fadeGain1: GainNode | null = null;
  private fadeGain2: GainNode | null = null;
  private modSource1: AudioBufferSourceNode | null = null;
  private modSource2: AudioBufferSourceNode | null = null;
  private modGainSource1: AudioBufferSourceNode | null = null;
  private modGainSource2: AudioBufferSourceNode | null = null;

  // Mid-Side / EQ nodes
  private eqNodes: AudioNode[] = [];

  private _semitones: number = 0;
  private _preserveTempo: boolean = true;
  private _playbackRate: number = 1.0;
  private _eqMode: AudioEqMode = 'normal';
  private _volume: number = 1.0;

  private _loopStart: number | null = null;
  private _loopEnd: number | null = null;

  private _isPlaying: boolean = false;
  private _anchorAudioTime: number = 0;
  private _anchorSongTime: number = 0;
  private _pausedAt: number = 0;
  private animFrameId: number | null = null;

  public onTimeUpdate?: (currentTime: number) => void;
  public onEnded?: () => void;
  public onStateChange?: (isPlaying: boolean) => void;

  constructor(options: PitchShiftPlayerOptions = {}) {
    this._semitones = options.semitones ?? 0;
    this._preserveTempo = options.preserveTempo ?? true;
    this._playbackRate = Math.max(0.6, Math.min(1.25, options.playbackRate ?? 1.0));
    this._eqMode = options.eqMode ?? 'normal';
    this._volume = options.volume ?? 1.0;
    this.onTimeUpdate = options.onTimeUpdate;
    this.onEnded = options.onEnded;
    this.onStateChange = options.onStateChange;
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setBuffer(audioBuffer: AudioBuffer): void {
    const wasPlaying = this._isPlaying;
    const currentPos = this.getCurrentTime();
    this.stopPlaybackInternal();
    this.buffer = audioBuffer;
    this._pausedAt = Math.min(currentPos, audioBuffer.duration);

    if (wasPlaying) {
      this.play(this._pausedAt);
    }
  }

  public get duration(): number {
    return this.buffer ? this.buffer.duration : 0;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get semitones(): number {
    return this._semitones;
  }

  public get preserveTempo(): boolean {
    return this._preserveTempo;
  }

  public get playbackRate(): number {
    return this._playbackRate;
  }

  public get eqMode(): AudioEqMode {
    return this._eqMode;
  }

  public getLoop(): { start: number | null; end: number | null } {
    return { start: this._loopStart, end: this._loopEnd };
  }

  private getEffectiveSourceSpeed(): number {
    if (!this._preserveTempo) {
      return Math.pow(2, this._semitones / 12) * this._playbackRate;
    }
    return this._playbackRate;
  }

  private rebaseClock(): void {
    if (!this.ctx || !this._isPlaying) return;
    const current = this.getCurrentTime();
    this._anchorSongTime = current;
    this._anchorAudioTime = this.ctx.currentTime;
    this._pausedAt = current;
  }

  /**
   * Sets pitch shift in semitones (-12 to +12).
   */
  public setPitch(semitones: number): void {
    const nextSemitones = Math.max(-12, Math.min(12, semitones));
    if (nextSemitones === this._semitones) return;

    if (this._isPlaying && !this._preserveTempo) {
      this.rebaseClock();
    }
    this._semitones = nextSemitones;

    if (!this._preserveTempo && this.sourceNode && this.ctx) {
      const rate = this.getEffectiveSourceSpeed();
      this.sourceNode.playbackRate.setValueAtTime(rate, this.ctx.currentTime);
    } else if (this._preserveTempo && this._isPlaying) {
      this.rebuildPitchShifterGraph();
    }
  }

  /**
   * Sets playback speed multiplier (0.6x – 1.25x) while compensating pitch when preserveTempo is enabled.
   */
  public setPlaybackRate(rate: number): void {
    const clamped = Number(Math.max(0.6, Math.min(1.25, rate)).toFixed(2));
    if (clamped === this._playbackRate) return;

    if (this._isPlaying) {
      this.rebaseClock();
    }
    this._playbackRate = clamped;

    if (this._isPlaying && this.sourceNode && this.ctx) {
      const speed = this.getEffectiveSourceSpeed();
      this.sourceNode.playbackRate.setValueAtTime(speed, this.ctx.currentTime);
      if (this._preserveTempo) {
        this.rebuildPitchShifterGraph();
      }
    }
  }

  /**
   * Toggles whether pitch shift preserves original song tempo or changes speed.
   */
  public setPreserveTempo(preserve: boolean): void {
    if (this._preserveTempo === preserve) return;
    this._preserveTempo = preserve;

    if (this._isPlaying) {
      const pos = this.getCurrentTime();
      this.stopPlaybackInternal();
      this.play(pos);
    }
  }

  /**
   * Sets real-time Mid-Side vocal cut or frequency isolation mode.
   */
  public setEqMode(mode: AudioEqMode): void {
    if (this._eqMode === mode) return;
    this._eqMode = mode;
    if (this._isPlaying && this.pitchOutNode && this.gainNode && this.ctx) {
      this.rebuildEqChain();
    }
  }

  /**
   * Configures an A-B rehearsal loop window in seconds.
   */
  public setLoop(startSec: number | null, endSec: number | null): void {
    if (startSec === null && endSec === null) {
      this.clearLoop();
      return;
    }
    const maxDur = this.duration > 0 ? this.duration : 3600;
    const s = startSec !== null ? Math.max(0, Math.min(startSec, maxDur)) : null;
    const e = endSec !== null ? Math.max(0, Math.min(endSec, maxDur)) : null;

    if (s !== null && e !== null && e <= s + 0.15) {
      this._loopStart = s;
      this._loopEnd = Math.min(maxDur, s + 0.5);
    } else {
      this._loopStart = s;
      this._loopEnd = e;
    }
  }

  public clearLoop(): void {
    this._loopStart = null;
    this._loopEnd = null;
  }

  public setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1.5, volume));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this._volume, this.ctx.currentTime);
    }
  }

  public play(startOffsetSec?: number): void {
    if (!this.buffer) return;
    const ctx = this.initContext();

    this.stopPlaybackInternal();

    const offset = typeof startOffsetSec === 'number'
      ? Math.max(0, Math.min(startOffsetSec, this.buffer.duration))
      : this._pausedAt;

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.buffer;

    this.pitchOutNode = ctx.createGain();
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(this._volume, ctx.currentTime);

    const pitchRatio = Math.pow(2, this._semitones / 12);
    const speed = this.getEffectiveSourceSpeed();
    this.sourceNode.playbackRate.setValueAtTime(speed, ctx.currentTime);

    if (!this._preserveTempo) {
      // Varispeed mode: playbackRate directly shifts both pitch & speed
      this.sourceNode.connect(this.pitchOutNode);
    } else {
      // Compensate speed-induced pitch change in Doppler shifter so final pitch stays at pitchRatio
      const targetDopplerRatio = pitchRatio / this._playbackRate;
      if (Math.abs(targetDopplerRatio - 1.0) < 0.002) {
        this.sourceNode.connect(this.pitchOutNode);
      } else {
        this.connectPitchShifter(this.sourceNode, this.pitchOutNode, targetDopplerRatio);
      }
    }

    this.rebuildEqChain();
    this.gainNode.connect(ctx.destination);

    this.sourceNode.onended = () => {
      if (this._isPlaying) {
        this._isPlaying = false;
        this._pausedAt = 0;
        this.stopTracking();
        this.onStateChange?.(false);
        this.onEnded?.();
      }
    };

    this.sourceNode.start(0, offset);
    this._anchorAudioTime = ctx.currentTime;
    this._anchorSongTime = offset;
    this._pausedAt = offset;
    this._isPlaying = true;

    this.startTracking();
    this.onStateChange?.(true);
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._pausedAt = this.getCurrentTime();
    this.stopPlaybackInternal();
    this.onStateChange?.(false);
  }

  public seek(timeSec: number): void {
    const clamped = Math.max(0, Math.min(timeSec, this.duration));
    this._pausedAt = clamped;

    if (this._isPlaying) {
      this.play(clamped);
    } else {
      this.onTimeUpdate?.(clamped);
    }
  }

  public getCurrentTime(): number {
    if (!this._isPlaying || !this.ctx) {
      return this._pausedAt;
    }

    const elapsedAudio = Math.max(0, this.ctx.currentTime - this._anchorAudioTime);
    const rate = this.getEffectiveSourceSpeed();
    const current = this._anchorSongTime + elapsedAudio * rate;

    return Math.min(current, this.duration);
  }

  private disconnectEqChain(): void {
    if (this.pitchOutNode) {
      try {
        this.pitchOutNode.disconnect();
      } catch {
        // ignore disconnect error
      }
    }
    for (const node of this.eqNodes) {
      try {
        node.disconnect();
      } catch {
        // ignore disconnect error
      }
    }
    this.eqNodes = [];
  }

  private rebuildEqChain(): void {
    if (!this.ctx || !this.pitchOutNode || !this.gainNode) return;
    const ctx = this.ctx;
    this.disconnectEqChain();

    if (this._eqMode === 'normal') {
      this.pitchOutNode.connect(this.gainNode);
      return;
    }

    if (this._eqMode === 'bass_isolate') {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(185, ctx.currentTime);
      lowpass.Q.setValueAtTime(0.95, ctx.currentTime);

      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.setValueAtTime(110, ctx.currentTime);
      lowShelf.gain.setValueAtTime(3.5, ctx.currentTime);

      this.pitchOutNode.connect(lowpass);
      lowpass.connect(lowShelf);
      lowShelf.connect(this.gainNode);
      this.eqNodes = [lowpass, lowShelf];
      return;
    }

    if (this._eqMode === 'guitar_focus') {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(175, ctx.currentTime);
      hp.Q.setValueAtTime(0.7, ctx.currentTime);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2800, ctx.currentTime);
      lp.Q.setValueAtTime(0.7, ctx.currentTime);

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.setValueAtTime(1050, ctx.currentTime);
      presence.Q.setValueAtTime(1.1, ctx.currentTime);
      presence.gain.setValueAtTime(3.0, ctx.currentTime);

      this.pitchOutNode.connect(hp);
      hp.connect(lp);
      lp.connect(presence);
      presence.connect(this.gainNode);
      this.eqNodes = [hp, lp, presence];
      return;
    }

    // vocal_cut: Mid-Side cancellation (L - R) on stereo tracks, or mid notch fallback on mono
    const channels = this.buffer?.numberOfChannels ?? 1;
    if (channels >= 2) {
      const splitter = ctx.createChannelSplitter(2);
      const invertR = ctx.createGain();
      invertR.gain.setValueAtTime(-1, ctx.currentTime);
      const monoSideSum = ctx.createGain();
      monoSideSum.gain.setValueAtTime(0.95, ctx.currentTime);

      // Keep subtle low-end mono bass below 120Hz so kick/bass aren't lost in L-R cancel
      const lowBypass = ctx.createBiquadFilter();
      lowBypass.type = 'lowpass';
      lowBypass.frequency.setValueAtTime(125, ctx.currentTime);
      const lowGain = ctx.createGain();
      lowGain.gain.setValueAtTime(0.65, ctx.currentTime);

      this.pitchOutNode.connect(splitter);
      splitter.connect(monoSideSum, 0);
      splitter.connect(invertR, 1);
      invertR.connect(monoSideSum);
      monoSideSum.connect(this.gainNode);

      this.pitchOutNode.connect(lowBypass);
      lowBypass.connect(lowGain);
      lowGain.connect(this.gainNode);

      this.eqNodes = [splitter, invertR, monoSideSum, lowBypass, lowGain];
    } else {
      const notch = ctx.createBiquadFilter();
      notch.type = 'peaking';
      notch.frequency.setValueAtTime(1150, ctx.currentTime);
      notch.Q.setValueAtTime(0.75, ctx.currentTime);
      notch.gain.setValueAtTime(-14, ctx.currentTime);
      this.pitchOutNode.connect(notch);
      notch.connect(this.gainNode);
      this.eqNodes = [notch];
    }
  }

  private stopPlaybackInternal(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // ignore stop error
      }
      this.sourceNode = null;
    }

    this.disconnectPitchShifter();
    this.disconnectEqChain();
    if (this.pitchOutNode) {
      try { this.pitchOutNode.disconnect(); } catch {}
      this.pitchOutNode = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch {}
      this.gainNode = null;
    }
    this.stopTracking();
    this._isPlaying = false;
  }

  private startTracking(): void {
    this.stopTracking();
    const update = () => {
      if (this._isPlaying) {
        const current = this.getCurrentTime();
        if (
          this._loopStart !== null &&
          this._loopEnd !== null &&
          this._loopEnd > this._loopStart &&
          current >= this._loopEnd
        ) {
          this.play(this._loopStart);
          return;
        }
        this.onTimeUpdate?.(current);
        this.animFrameId = requestAnimationFrame(update);
      }
    };
    this.animFrameId = requestAnimationFrame(update);
  }

  private stopTracking(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Connects audio through a real-time Doppler phase vocoder delay network.
   * Modulates two delay lines in quadrature with cosine crossfade windows.
   */
  private connectPitchShifter(source: AudioNode, dest: AudioNode, pitchRatio: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const windowSec = 0.08;
    const numSamples = Math.floor(ctx.sampleRate * windowSec);

    const delayBuffer1 = ctx.createBuffer(1, numSamples, ctx.sampleRate);
    const delayBuffer2 = ctx.createBuffer(1, numSamples, ctx.sampleRate);

    const d1 = delayBuffer1.getChannelData(0);
    const d2 = delayBuffer2.getChannelData(0);

    const maxDelay = 0.05;
    const slope = 1 - pitchRatio;

    for (let i = 0; i < numSamples; i++) {
      const phase1 = i / numSamples;
      const phase2 = (phase1 + 0.5) % 1.0;

      d1[i] = slope >= 0 ? phase1 * maxDelay : (1 - phase1) * maxDelay;
      d2[i] = slope >= 0 ? phase2 * maxDelay : (1 - phase2) * maxDelay;
    }

    // Apply smooth cosine crossfade via GainBuffers or PeriodicWave-style windowing
    const gainBuffer1 = ctx.createBuffer(1, numSamples, ctx.sampleRate);
    const gainBuffer2 = ctx.createBuffer(1, numSamples, ctx.sampleRate);
    const g1 = gainBuffer1.getChannelData(0);
    const g2 = gainBuffer2.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      const p1 = i / numSamples;
      const p2 = (p1 + 0.5) % 1.0;
      g1[i] = 0.5 * (1 - Math.cos(2 * Math.PI * p1));
      g2[i] = 0.5 * (1 - Math.cos(2 * Math.PI * p2));
    }

    this.delayNode1 = ctx.createDelay(1.0);
    this.delayNode2 = ctx.createDelay(1.0);
    this.fadeGain1 = ctx.createGain();
    this.fadeGain2 = ctx.createGain();
    this.fadeGain1.gain.setValueAtTime(0, ctx.currentTime);
    this.fadeGain2.gain.setValueAtTime(0, ctx.currentTime);

    this.modSource1 = ctx.createBufferSource();
    this.modSource1.buffer = delayBuffer1;
    this.modSource1.loop = true;

    this.modSource2 = ctx.createBufferSource();
    this.modSource2.buffer = delayBuffer2;
    this.modSource2.loop = true;

    this.modGainSource1 = ctx.createBufferSource();
    this.modGainSource1.buffer = gainBuffer1;
    this.modGainSource1.loop = true;

    this.modGainSource2 = ctx.createBufferSource();
    this.modGainSource2.buffer = gainBuffer2;
    this.modGainSource2.loop = true;

    this.modSource1.connect(this.delayNode1.delayTime);
    this.modSource2.connect(this.delayNode2.delayTime);
    this.modGainSource1.connect(this.fadeGain1.gain);
    this.modGainSource2.connect(this.fadeGain2.gain);

    source.connect(this.delayNode1);
    source.connect(this.delayNode2);

    this.delayNode1.connect(this.fadeGain1);
    this.delayNode2.connect(this.fadeGain2);

    this.fadeGain1.connect(dest);
    this.fadeGain2.connect(dest);

    const freq = Math.abs(1 - pitchRatio) / windowSec;
    const modRate = Math.max(0.15, Math.min(12, freq * windowSec));

    this.modSource1.playbackRate.setValueAtTime(modRate, ctx.currentTime);
    this.modSource2.playbackRate.setValueAtTime(modRate, ctx.currentTime);
    this.modGainSource1.playbackRate.setValueAtTime(modRate, ctx.currentTime);
    this.modGainSource2.playbackRate.setValueAtTime(modRate, ctx.currentTime);

    this.modSource1.start(0);
    this.modSource2.start(0);
    this.modGainSource1.start(0);
    this.modGainSource2.start(0);
  }

  private rebuildPitchShifterGraph(): void {
    if (!this.sourceNode || !this.pitchOutNode || !this.ctx) return;
    try {
      this.sourceNode.disconnect();
    } catch {
      // ignore disconnect error
    }
    this.disconnectPitchShifter();

    const pitchRatio = Math.pow(2, this._semitones / 12);
    const targetDopplerRatio = this._preserveTempo ? pitchRatio / this._playbackRate : 1.0;

    if (!this._preserveTempo || Math.abs(targetDopplerRatio - 1.0) < 0.002) {
      this.sourceNode.connect(this.pitchOutNode);
    } else {
      this.connectPitchShifter(this.sourceNode, this.pitchOutNode, targetDopplerRatio);
    }
  }

  private disconnectPitchShifter(): void {
    for (const s of [this.modSource1, this.modSource2, this.modGainSource1, this.modGainSource2]) {
      if (s) {
        try {
          s.stop();
          s.disconnect();
        } catch {}
      }
    }
    this.modSource1 = null;
    this.modSource2 = null;
    this.modGainSource1 = null;
    this.modGainSource2 = null;
    if (this.delayNode1) {
      try { this.delayNode1.disconnect(); } catch {}
      this.delayNode1 = null;
    }
    if (this.delayNode2) {
      try { this.delayNode2.disconnect(); } catch {}
      this.delayNode2 = null;
    }
    if (this.fadeGain1) {
      try { this.fadeGain1.disconnect(); } catch {}
      this.fadeGain1 = null;
    }
    if (this.fadeGain2) {
      try { this.fadeGain2.disconnect(); } catch {}
      this.fadeGain2 = null;
    }
  }

  public dispose(): void {
    this.stopPlaybackInternal();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        void this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }
}
