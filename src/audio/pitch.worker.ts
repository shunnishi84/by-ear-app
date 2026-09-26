/// <reference lib="webworker" />
import { yinTrack } from './yin';
import { segmentNotes } from './segment';

export interface PitchRequest {
  samples: Float32Array;
  sampleRate: number;
  minMidi: number;
  maxMidi: number;
}

self.onmessage = (ev: MessageEvent<PitchRequest>) => {
  const { samples, sampleRate, minMidi, maxMidi } = ev.data;
  try {
    const frames = yinTrack(samples, {
      sampleRate,
      fmin: 440 * 2 ** ((minMidi - 1 - 69) / 12),
      fmax: 440 * 2 ** ((maxMidi + 1 - 69) / 12),
      onProgress: (r) => self.postMessage({ type: 'progress', ratio: r }),
    });
    const notes = segmentNotes(frames, { minMidi, maxMidi });
    self.postMessage({ type: 'done', notes });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e) });
  }
};
