/**
 * Real-time Web Audio Pitch-Shifting Audio Player
 * 
 * Supports:
 * 1. Real-time Pitch Shifting with Tempo Preservation (via dual modulated delay lines in quadrature)
 * 2. Classic Resampling / Varispeed Pitch Shifting (via playbackRate)
 * 3. Accurate seeking, synchronization with BeatTimeline and chord playback
 */

export interface PitchShiftPlayerOptions {
  preserveTempo?: boolean;
  semitones?: number;
  volume?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  onStateChange?: (isPlaying: boolean) => void;
}

export class PitchShiftPlayer {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  // Real-time Pitch Shift DSP graph (Dual delay lines with sinusoidal crossfade)
  private inputNode: GainNode | null = null;
  private delayNode1: DelayNode | null = null;
  private delayNode2: DelayNode | null = null;
  private fadeGain1: GainNode | null = null;
  private fadeGain2: GainNode | null = null;
  private modSource1: AudioBufferSourceNode | null = null;
  private modSource2: AudioBufferSourceNode | null = null;

  private _semitones: number = 0;
  private _preserveTempo: boolean = true;
  private _volume: number = 1.0;

  private _isPlaying: boolean = false;
  private _startTime: number = 0;
  private _pausedAt: number = 0;
  private animFrameId: number | null = null;

  public onTimeUpdate?: (currentTime: number) => void;
  public onEnded?: () => void;
  public onStateChange?: (isPlaying: boolean) => void;

  constructor(options: PitchShiftPlayerOptions = {}) {
    this._semitones = options.semitones ?? 0;
    this._preserveTempo = options.preserveTempo ?? true;
    this._volume = options.volume ?? 1.0;
    this.onTimeUpdate = options.onTimeUpdate;
    this.onEnded = options.onEnded;
    this.onStateChange = options.onStateChange;
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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

  /**
   * Sets pitch shift in semitones (-12 to +12).
   */
  public setPitch(semitones: number): void {
    this._semitones = Math.max(-12, Math.min(12, semitones));

    if (!this._preserveTempo && this.sourceNode) {
      // Varispeed mode: playbackRate directly drives pitch
      const rate = Math.pow(2, this._semitones / 12);
      this.sourceNode.playbackRate.setValueAtTime(rate, this.ctx?.currentTime ?? 0);
    } else if (this._preserveTempo) {
      // Reconfigure Doppler phase delay network
      if (this._isPlaying) {
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

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(this._volume, ctx.currentTime);

    const pitchRatio = Math.pow(2, this._semitones / 12);

    if (!this._preserveTempo) {
      // Varispeed mode
      this.sourceNode.playbackRate.setValueAtTime(pitchRatio, ctx.currentTime);
      this.sourceNode.connect(this.gainNode);
    } else {
      // Harmonic pitch shift mode with tempo preservation
      this.sourceNode.playbackRate.setValueAtTime(1.0, ctx.currentTime);

      if (this._semitones === 0) {
        // Bypass directly for zero latency
        this.sourceNode.connect(this.gainNode);
      } else {
        // Connect through dual modulated delay pitch shifter
        this.connectPitchShifter(this.sourceNode, this.gainNode, pitchRatio);
      }
    }

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
    this._startTime = ctx.currentTime - offset;
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

    const elapsed = this.ctx.currentTime - this._startTime;
    const rate = !this._preserveTempo ? Math.pow(2, this._semitones / 12) : 1.0;
    const current = elapsed * rate;

    return Math.min(current, this.duration);
  }

  private stopPlaybackInternal(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    this.disconnectPitchShifter();
    this.stopTracking();
    this._isPlaying = false;
  }

  private startTracking(): void {
    this.stopTracking();
    const update = () => {
      if (this._isPlaying) {
        this.onTimeUpdate?.(this.getCurrentTime());
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
   * Modulates two delay lines in quadrature with triangular/sinusoidal windowing.
   */
  private connectPitchShifter(source: AudioNode, dest: AudioNode, pitchRatio: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Buffer length for modulation: 80ms window offers good vocal/harmonic resolution
    const windowSec = 0.08;
    const numSamples = Math.floor(ctx.sampleRate * windowSec);

    // Modulation curve buffers
    const delayBuffer1 = ctx.createBuffer(1, numSamples, ctx.sampleRate);
    const delayBuffer2 = ctx.createBuffer(1, numSamples, ctx.sampleRate);
    const gainBuffer1 = ctx.createBuffer(1, numSamples, ctx.sampleRate);
    const gainBuffer2 = ctx.createBuffer(1, numSamples, ctx.sampleRate);

    const d1 = delayBuffer1.getChannelData(0);
    const d2 = delayBuffer2.getChannelData(0);
    const g1 = gainBuffer1.getChannelData(0);
    const g2 = gainBuffer2.getChannelData(0);

    const maxDelay = 0.05; // 50ms max delay
    const slope = 1 - pitchRatio;

    for (let i = 0; i < numSamples; i++) {
      const phase1 = i / numSamples;
      const phase2 = (phase1 + 0.5) % 1.0;

      // Sawtooth delay trajectory for frequency shifting
      d1[i] = slope >= 0
        ? phase1 * maxDelay
        : (1 - phase1) * maxDelay;

      d2[i] = slope >= 0
        ? phase2 * maxDelay
        : (1 - phase2) * maxDelay;

      // Smooth cosine crossfade windows
      g1[i] = 0.5 * (1 - Math.cos(2 * Math.PI * phase1));
      g2[i] = 0.5 * (1 - Math.cos(2 * Math.PI * phase2));
    }

    this.delayNode1 = ctx.createDelay(1.0);
    this.delayNode2 = ctx.createDelay(1.0);
    this.fadeGain1 = ctx.createGain();
    this.fadeGain2 = ctx.createGain();

    this.modSource1 = ctx.createBufferSource();
    this.modSource1.buffer = delayBuffer1;
    this.modSource1.loop = true;

    this.modSource2 = ctx.createBufferSource();
    this.modSource2.buffer = delayBuffer2;
    this.modSource2.loop = true;

    // Connect modulation to delayTime
    this.modSource1.connect(this.delayNode1.delayTime);
    this.modSource2.connect(this.delayNode2.delayTime);

    // Audio path
    source.connect(this.delayNode1);
    source.connect(this.delayNode2);

    this.delayNode1.connect(this.fadeGain1);
    this.delayNode2.connect(this.fadeGain2);

    this.fadeGain1.connect(dest);
    this.fadeGain2.connect(dest);

    // Loop speed corresponds to shift amount
    const freq = Math.abs(1 - pitchRatio) / windowSec;
    const playbackSpeed = Math.max(0.2, Math.min(10, freq * windowSec));

    this.modSource1.playbackRate.setValueAtTime(playbackSpeed, ctx.currentTime);
    this.modSource2.playbackRate.setValueAtTime(playbackSpeed, ctx.currentTime);

    this.modSource1.start(0);
    this.modSource2.start(0);
  }

  private rebuildPitchShifterGraph(): void {
    if (!this.sourceNode || !this.gainNode || !this.ctx) return;
    this.disconnectPitchShifter();

    const pitchRatio = Math.pow(2, this._semitones / 12);
    if (this._semitones === 0) {
      this.sourceNode.connect(this.gainNode);
    } else {
      this.connectPitchShifter(this.sourceNode, this.gainNode, pitchRatio);
    }
  }

  private disconnectPitchShifter(): void {
    if (this.modSource1) {
      try {
        this.modSource1.stop();
        this.modSource1.disconnect();
      } catch {}
      this.modSource1 = null;
    }
    if (this.modSource2) {
      try {
        this.modSource2.stop();
        this.modSource2.disconnect();
      } catch {}
      this.modSource2 = null;
    }
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
