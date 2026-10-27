/**
 * Utility functions for AudioBuffer channel extraction and mixing
 */

/**
 * Extracts a mono Float32Array from an AudioBuffer, mixing channels if stereo
 */
export function extractMonoChannelData(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (numChannels === 1) {
    const mono = new Float32Array(length);
    mono.set(audioBuffer.getChannelData(0));
    return mono;
  }

  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.getChannelData(1);
  const mono = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    mono[i] = (ch0[i] + ch1[i]) * 0.5;
  }

  return mono;
}
