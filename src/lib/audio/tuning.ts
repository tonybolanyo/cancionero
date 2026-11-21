/**
 * Tuning Calibration (Detuning vs A4=440Hz) & Real-Time YIN Microphone Pitch Detection.
 * 100% client-side DSP without external dependencies.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface DetuningEstimate {
  /** Signed offset in cents (-50..+50) relative to standard A4 = 440 Hz */
  cents: number;
  /** Calibrated A4 reference frequency in Hz */
  referenceA4Hz: number;
  /** Confidence 0..1 */
  confidence: number;
}

export interface PitchDetectionResult {
  frequencyHz: number;
  midi: number;
  noteName: string;
  octave: number;
  cents: number;
  clarity: number;
}

/**
 * Computes normalized Goertzel spectral power at a single target frequency.
 */
function goertzelPower(frame: Float64Array, sampleRate: number, freqHz: number): number {
  const N = frame.length;
  if (N === 0 || freqHz <= 0 || freqHz >= sampleRate * 0.48) return 0;
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    const s0 = frame[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/**
 * Estimates global tuning offset in cents (-50..+50) relative to A4=440Hz
 * by building a sub-semitone 5-cent histogram across acoustic guitar / voice range (110Hz..660Hz).
 * Helps accurately analyze home acoustic demos tuned slightly flat or sharp (e.g. A=432Hz or A=445Hz).
 */
export function estimateDetuningCents(
  signal: Float32Array,
  sampleRate: number
): DetuningEstimate {
  if (!signal || signal.length < 1024 || sampleRate <= 0) {
    return { cents: 0, referenceA4Hz: 440, confidence: 0 };
  }

  // Downsample to ~4410 Hz for fast & narrow-band frequency resolution
  const step = Math.max(1, Math.floor(sampleRate / 4410));
  const effRate = sampleRate / step;
  const frameLen = Math.min(2048, Math.floor(effRate * 0.45));
  if (frameLen < 256) {
    return { cents: 0, referenceA4Hz: 440, confidence: 0 };
  }

  // Sample up to 8 frames distributed across the middle 75% of the track
  const startSample = Math.floor(signal.length * 0.12);
  const usableSpan = Math.max(frameLen * step, Math.floor(signal.length * 0.75));
  const numFrames = 8;
  const hop = Math.max(frameLen * step, Math.floor(usableSpan / numFrames));

  // Bin centers from -50 to +45 cents in 5-cent steps (20 bins)
  const binStep = 5;
  const bins: number[] = [];
  for (let c = -50; c <= 45; c += binStep) {
    bins.push(c);
  }
  const histogram = new Float64Array(bins.length);
  const hann = new Float64Array(frameLen);
  for (let i = 0; i < frameLen; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, frameLen - 1)));
  }

  // Representative chromatic pitches in mid-register (MIDI 48=C3 .. 72=C5)
  const probeMidis = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71];
  const windowed = new Float64Array(frameLen);

  let activeFrames = 0;
  for (let f = 0; f < numFrames; f++) {
    const base = startSample + f * hop;
    if (base + frameLen * step >= signal.length) break;

    let energy = 0;
    for (let i = 0; i < frameLen; i++) {
      const val = signal[base + i * step];
      energy += val * val;
      windowed[i] = val * hann[i];
    }
    const rms = Math.sqrt(energy / frameLen);
    if (rms < 0.008) continue;
    activeFrames++;

    // Coarse semitone pass at 0 cents to find strongest 3 notes in frame
    const noteEnergies = probeMidis.map(midi => {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      return { midi, p: goertzelPower(windowed, effRate, freq) };
    });
    noteEnergies.sort((a, b) => b.p - a.p);
    const topNotes = noteEnergies.slice(0, 3);

    for (const { midi } of topNotes) {
      let bestBinIdx = -1;
      let bestBinPower = 0;
      let totalBinPower = 0;
      const powers = new Float64Array(bins.length);

      for (let b = 0; b < bins.length; b++) {
        const cents = bins[b];
        const freq = 440 * Math.pow(2, (midi - 69 + cents / 100) / 12);
        const p = goertzelPower(windowed, effRate, freq);
        powers[b] = p;
        totalBinPower += p;
        if (p > bestBinPower) {
          bestBinPower = p;
          bestBinIdx = b;
        }
      }

      if (bestBinIdx >= 0 && totalBinPower > 0) {
        const sharpness = bestBinPower / (totalBinPower / bins.length);
        if (sharpness > 1.35) {
          histogram[bestBinIdx] += Math.sqrt(bestBinPower) * sharpness;
        }
      }
    }
  }

  if (activeFrames === 0) {
    return { cents: 0, referenceA4Hz: 440, confidence: 0 };
  }

  // Circular smoothing on histogram (since -50 cents wraps near +50 cents)
  let totalHist = 0;
  let bestIdx = 0;
  let bestVal = -1;
  const smoothed = new Float64Array(bins.length);
  for (let i = 0; i < bins.length; i++) {
    const prev = histogram[(i - 1 + bins.length) % bins.length];
    const curr = histogram[i];
    const next = histogram[(i + 1) % bins.length];
    smoothed[i] = 0.25 * prev + 0.5 * curr + 0.25 * next;
    totalHist += smoothed[i];
    if (smoothed[i] > bestVal) {
      bestVal = smoothed[i];
      bestIdx = i;
    }
  }

  if (totalHist <= 0 || bestVal <= 0) {
    return { cents: 0, referenceA4Hz: 440, confidence: 0 };
  }

  // Parabolic interpolation around best bin
  const prevVal = smoothed[(bestIdx - 1 + bins.length) % bins.length];
  const nextVal = smoothed[(bestIdx + 1) % bins.length];
  const denom = prevVal - 2 * bestVal + nextVal;
  const shift = Math.abs(denom) > 1e-9 ? 0.5 * ((prevVal - nextVal) / denom) : 0;
  let estimatedCents = bins[bestIdx] + Math.max(-0.5, Math.min(0.5, shift)) * binStep;
  estimatedCents = Math.round(estimatedCents * 10) / 10;

  if (estimatedCents > 50) estimatedCents -= 100;
  if (estimatedCents < -50) estimatedCents += 100;

  const meanHist = totalHist / bins.length;
  const peakRatio = bestVal / Math.max(1e-9, meanHist);
  const confidence = Number(Math.max(0, Math.min(1, (peakRatio - 1.1) / 2.2)).toFixed(2));
  const referenceA4Hz = Number((440 * Math.pow(2, estimatedCents / 1200)).toFixed(2));

  // Ignore tiny < 4 cents jitter with low confidence
  if (Math.abs(estimatedCents) < 4 && confidence < 0.45) {
    return { cents: 0, referenceA4Hz: 440, confidence };
  }

  return { cents: estimatedCents, referenceA4Hz, confidence };
}

/**
 * YIN fundamental frequency detector (de Cheveigné & Kawahara, 2002)
 * using Cumulative Mean Normalized Difference Function (CMNDF) + parabolic interpolation.
 * Ideal for monophonic guitar/ukulele/voice microphone tuning.
 */
export function detectPitchYIN(
  frameData: Float32Array,
  sampleRate: number,
  referenceA4Hz: number = 440,
  threshold: number = 0.14
): PitchDetectionResult | null {
  const N = frameData.length;
  if (N < 512 || sampleRate <= 0) return null;

  // Noise gate: skip quiet room background
  let rms = 0;
  for (let i = 0; i < N; i++) {
    rms += frameData[i] * frameData[i];
  }
  rms = Math.sqrt(rms / N);
  if (rms < 0.008) return null;

  const halfN = Math.floor(N / 2);
  const minPeriod = Math.max(2, Math.floor(sampleRate / 1200)); // up to ~1200 Hz
  const maxPeriod = Math.min(halfN - 1, Math.floor(sampleRate / 62)); // down to ~62 Hz (B1/C2)

  if (maxPeriod <= minPeriod + 2) return null;

  const yinBuffer = new Float64Array(maxPeriod + 1);

  // Step 1: Squared difference function d(tau)
  for (let tau = 1; tau <= maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < halfN; i++) {
      const delta = frameData[i] - frameData[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference function d'(tau)
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxPeriod; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum > 0 ? (yinBuffer[tau] * tau) / runningSum : 1;
  }

  // Step 3: Absolute threshold (pick first local minimum below threshold)
  let tauEstimate = -1;
  for (let tau = minPeriod; tau < maxPeriod; tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // Fallback to global minimum if clear pitch exists below 0.28
  if (tauEstimate === -1) {
    let minVal = 1;
    for (let tau = minPeriod; tau < maxPeriod; tau++) {
      if (yinBuffer[tau] < minVal) {
        minVal = yinBuffer[tau];
        tauEstimate = tau;
      }
    }
    if (minVal > 0.28 || tauEstimate === -1) {
      return null;
    }
  }

  // Step 4: Parabolic interpolation for sub-sample precision
  let betterTau = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxPeriod) {
    const s0 = yinBuffer[tauEstimate - 1];
    const s1 = yinBuffer[tauEstimate];
    const s2 = yinBuffer[tauEstimate + 1];
    const denom = 2 * (s0 - 2 * s1 + s2);
    if (Math.abs(denom) > 1e-12) {
      const adj = (s0 - s2) / denom;
      betterTau = tauEstimate + Math.max(-0.5, Math.min(0.5, adj));
    }
  }

  const frequencyHz = sampleRate / betterTau;
  if (!Number.isFinite(frequencyHz) || frequencyHz < 55 || frequencyHz > 1400) {
    return null;
  }

  const clarity = Number(Math.max(0, Math.min(1, 1 - yinBuffer[tauEstimate])).toFixed(3));
  const midiFloat = 69 + 12 * Math.log2(frequencyHz / referenceA4Hz);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;

  return {
    frequencyHz: Number(frequencyHz.toFixed(2)),
    midi,
    noteName: NOTE_NAMES[pc],
    octave,
    cents,
    clarity
  };
}
