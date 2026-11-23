export type MetronomeTimeSignature =
  | '2/4'
  | '3/4'
  | '4/4'
  | '5/4'
  | '7/4'
  | '5/8'
  | '6/8'
  | '7/8'
  | '9/8'
  | '12/8';

export interface MetronomeBeatEvent {
  beatIndex: number; // 0-based beat inside current bar
  beatsPerBar: number;
  isDownbeat: boolean;
  isSubdivisionAccent: boolean;
}

export function getBeatsPerBar(timeSignature: string = '4/4'): number {
  const clean = (timeSignature || '4/4').trim();
  const num = parseInt(clean.split('/')[0], 10);
  if (Number.isFinite(num) && num >= 2 && num <= 16) return num;
  return 4;
}

/**
 * Pure-TS Tap Tempo tracker for measuring BPM from consecutive user taps.
 */
export class TapTempoTracker {
  private timestamps: number[] = [];
  private readonly resetThresholdMs: number;
  private readonly maxHistory: number;

  constructor(resetThresholdMs: number = 2200, maxHistory: number = 8) {
    this.resetThresholdMs = resetThresholdMs;
    this.maxHistory = maxHistory;
  }

  public tap(nowMs: number = Date.now()): { bpm: number | null; tapCount: number } {
    if (
      this.timestamps.length > 0 &&
      nowMs - this.timestamps[this.timestamps.length - 1] > this.resetThresholdMs
    ) {
      this.timestamps = [];
    }

    this.timestamps.push(nowMs);
    if (this.timestamps.length > this.maxHistory) {
      this.timestamps = this.timestamps.slice(-this.maxHistory);
    }

    if (this.timestamps.length < 2) {
      return { bpm: null, tapCount: this.timestamps.length };
    }

    const intervals: number[] = [];
    for (let i = 1; i < this.timestamps.length; i++) {
      const diff = this.timestamps[i] - this.timestamps[i - 1];
      if (diff > 150 && diff < 2500) {
        intervals.push(diff);
      }
    }

    if (intervals.length === 0) {
      return { bpm: null, tapCount: this.timestamps.length };
    }

    const avgMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
    const rawBpm = Math.round(60000 / avgMs);
    const clampedBpm = Math.max(35, Math.min(260, rawBpm));
    return { bpm: clampedBpm, tapCount: this.timestamps.length };
  }

  public reset(): void {
    this.timestamps = [];
  }
}

/**
 * High-precision lookahead Web Audio Metronome using AudioContext.currentTime.
 * Keeps rock-solid timing regardless of React re-renders.
 */
export class PrecisionMetronome {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private bpm: number = 100;
  private timeSignature: string = '4/4';
  private volume: number = 0.7;

  private currentBeatInBar: number = 0;
  private nextNoteTime: number = 0;
  private schedulerTimer: number | null = null;
  private uiTimers: Set<number> = new Set();

  private readonly lookaheadMs = 25;
  private readonly scheduleAheadTimeSec = 0.11;

  public onBeat?: (event: MetronomeBeatEvent) => void;
  public onStateChange?: (running: boolean) => void;

  constructor(options?: {
    bpm?: number;
    timeSignature?: string;
    volume?: number;
    onBeat?: (event: MetronomeBeatEvent) => void;
    onStateChange?: (running: boolean) => void;
  }) {
    if (options?.bpm) this.bpm = Math.max(35, Math.min(260, options.bpm));
    if (options?.timeSignature) this.timeSignature = options.timeSignature;
    if (typeof options?.volume === 'number') this.volume = options.volume;
    this.onBeat = options?.onBeat;
    this.onStateChange = options?.onStateChange;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setBpm(bpm: number): void {
    this.bpm = Math.max(35, Math.min(260, Math.round(bpm) || 100));
  }

  public setTimeSignature(timeSignature: string): void {
    this.timeSignature = timeSignature || '4/4';
    const beatsPerBar = getBeatsPerBar(this.timeSignature);
    if (this.currentBeatInBar >= beatsPerBar) {
      this.currentBeatInBar = 0;
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public get running(): boolean {
    return this.isRunning;
  }

  public start(): void {
    if (this.isRunning) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isRunning = true;
    this.currentBeatInBar = 0;
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.onStateChange?.(true);

    this.schedulerTimer = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
  }

  public stop(): void {
    if (!this.isRunning && this.schedulerTimer === null) return;
    this.isRunning = false;

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    for (const id of this.uiTimers) {
      window.clearTimeout(id);
    }
    this.uiTimers.clear();
    this.onStateChange?.(false);
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
    return this.isRunning;
  }

  private scheduler(): void {
    if (!this.ctx || !this.isRunning) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTimeSec) {
      this.scheduleClick(this.currentBeatInBar, this.nextNoteTime);
      this.advanceBeat();
    }
  }

  private advanceBeat(): void {
    const beatsPerBar = getBeatsPerBar(this.timeSignature);
    // In /8 compound or irregular meters (5/8, 6/8, 7/8, 9/8, 12/8), eighth-note clicks run at 2x quarter BPM.
    const isEighthMeter = this.timeSignature.trim().endsWith('/8');
    const secondsPerBeat = isEighthMeter ? 60 / (this.bpm * 2) : 60 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeatInBar = (this.currentBeatInBar + 1) % beatsPerBar;
  }

  private scheduleClick(beatIndex: number, time: number): void {
    if (!this.ctx) return;
    const beatsPerBar = getBeatsPerBar(this.timeSignature);
    const isDownbeat = beatIndex === 0;
    const cleanMeter = this.timeSignature.trim();
    const isSubdivisionAccent =
      (cleanMeter === '6/8' && beatIndex === 3) ||
      (cleanMeter === '9/8' && (beatIndex === 3 || beatIndex === 6)) ||
      (cleanMeter === '12/8' && (beatIndex === 3 || beatIndex === 6 || beatIndex === 9)) ||
      ((cleanMeter === '5/4' || cleanMeter === '5/8') && beatIndex === 3) ||
      ((cleanMeter === '7/4' || cleanMeter === '7/8') && (beatIndex === 2 || beatIndex === 4));

    // Woodblock / crisp percussive click synthesized cleanly
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = isDownbeat ? 1320 : isSubdivisionAccent ? 990 : 760;
    const peakGain = (isDownbeat ? 0.65 : isSubdivisionAccent ? 0.44 : 0.30) * this.volume;

    osc.type = isDownbeat ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, time + 0.035);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, peakGain), time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.048);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.055);

    if (this.onBeat) {
      const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
      const timerId = window.setTimeout(() => {
        this.uiTimers.delete(timerId);
        if (this.isRunning) {
          this.onBeat?.({
            beatIndex,
            beatsPerBar,
            isDownbeat,
            isSubdivisionAccent
          });
        }
      }, delayMs);
      this.uiTimers.add(timerId);
    }
  }

  public dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        void this.ctx.close();
      } catch {
        // ignore close error
      }
      this.ctx = null;
    }
  }
}
