declare module 'essentia.js/dist/essentia-wasm.web.js' {
  const EssentiaWASM: (options?: any) => Promise<any>;
  export default EssentiaWASM;
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  export default class Essentia {
    constructor(wasmModule: any);
    algorithms: any;
    arrayToVector(arr: Float32Array | number[]): any;
    vectorToArray(vector: any): Float32Array;
    KeyExtractor(
      audio: any,
      averageDetuningCorrection?: boolean,
      frameSize?: number,
      hopSize?: number,
      hpcpSize?: number,
      maxFrequency?: number,
      maximumSpectralPeaks?: number,
      minFrequency?: number,
      pcpThreshold?: number,
      profileType?: string,
      sampleRate?: number,
      spectralPeaksThreshold?: number,
      tuningFrequency?: number,
      weightType?: string,
      windowType?: string
    ): {
      key: string;
      scale: string;
      strength: number;
      firstToSecondRelativeStrength?: number;
    };
    Windowing(frame: any, type?: string, zeroPadding?: number, zeroPhase?: boolean): { frame: any };
    Spectrum(frame: any, size?: number): { spectrum: any };
    SpectralPeaks(
      spectrum: any,
      magnitudeThreshold?: number,
      maxFrequency?: number,
      maxPeaks?: number,
      minFrequency?: number,
      orderBy?: string,
      sampleRate?: number
    ): {
      frequencies: any;
      magnitudes: any;
    };
    HPCP(
      frequencies: any,
      magnitudes: any,
      bandPreset?: boolean,
      bandSplitFrequency?: number,
      harmonics?: number,
      maxFrequency?: number,
      maxShifted?: boolean,
      minFrequency?: number,
      nonLinear?: boolean,
      normalized?: string,
      referenceFrequency?: number,
      sampleRate?: number,
      size?: number,
      weightType?: string,
      windowSize?: number
    ): {
      hpcp: any;
    };
    TonalExtractor(
      signal: any,
      frameSize?: number,
      hopSize?: number,
      tuningFrequency?: number
    ): {
      chords_changes_rate: number;
      chords_histogram: any;
      chords_key: string;
      chords_number_rate: number;
      chords_progression: any;
      chords_scale: string;
      chords_strength: any;
      hpcp: any;
      hpcp_highres: any;
      key_key: string;
      key_scale: string;
      key_strength: number;
    };
    ChordsDetection(
      pcp: any,
      hopSize?: number,
      sampleRate?: number,
      windowSize?: number
    ): {
      chords: any;
      strength: any;
    };
  }
}
