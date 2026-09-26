export const ANALYSIS_RATE = 22050;

let shared: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!shared || shared.state === 'closed') shared = new AudioContext();
  return shared;
}

export async function decodeFile(file: Blob): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  return await audioContext().decodeAudioData(data);
}

/** Mono, 22.05 kHz copy of [startSec, endSec) for analysis. */
export async function toAnalysisRate(buf: AudioBuffer, startSec = 0, endSec?: number): Promise<Float32Array> {
  const end = Math.min(endSec ?? buf.duration, buf.duration);
  const start = Math.max(0, Math.min(startSec, end));
  const len = Math.max(1, Math.ceil((end - start) * ANALYSIS_RATE));
  const off = new OfflineAudioContext(1, len, ANALYSIS_RATE);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start(0, start, end - start);
  const out = await off.startRendering();
  return out.getChannelData(0).slice();
}
