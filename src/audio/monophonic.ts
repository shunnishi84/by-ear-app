import type { RawNote } from './notes';

/** Run YIN + segmentation in a Web Worker. */
export function monophonicNotes(
  samples: Float32Array,
  sampleRate: number,
  range: { minMidi: number; maxMidi: number },
  onProgress: (r: number) => void,
): Promise<RawNote[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pitch.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type === 'progress') onProgress(msg.ratio);
      else if (msg.type === 'done') {
        worker.terminate();
        resolve(msg.notes as RawNote[]);
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ samples, sampleRate, ...range }, [samples.buffer]);
  });
}
