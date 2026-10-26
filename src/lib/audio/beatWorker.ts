import { detect } from '@audio/beat';

export interface BeatWorkerRequest {
  id: string;
  channelData: Float32Array;
  sampleRate: number;
  minBpm?: number;
  maxBpm?: number;
}

export interface BeatWorkerResponse {
  id: string;
  success: boolean;
  result?: {
    onsets: number[];
    beats: number[];
    tempo: number;
  };
  error?: string;
}

self.onmessage = (e: MessageEvent<BeatWorkerRequest>) => {
  const { id, channelData, sampleRate, minBpm, maxBpm } = e.data;
  try {
    const res = detect(channelData, {
      fs: sampleRate,
      minBpm: minBpm ?? 60,
      maxBpm: maxBpm ?? 180
    });

    const onsets = Array.from(res.onsets);
    const beats = Array.from(res.beats);
    const tempo = Number(res.bpm.toFixed(2));

    const response: BeatWorkerResponse = {
      id,
      success: true,
      result: { onsets, beats, tempo }
    };
    self.postMessage(response);
  } catch (err: any) {
    const response: BeatWorkerResponse = {
      id,
      success: false,
      error: err?.message || 'Error analizando onsets y compases rítmicos'
    };
    self.postMessage(response);
  }
};
