import { midiToHz } from '../src/audio/notes';

/** Render a melody [midi|null, beats][] to a mono buffer with a brass-ish tone. */
export function renderMelody(
  melody: [number | null, number][],
  bpm: number,
  sr = 22050,
  leadIn = 0.3,
  detached = 0.03,
): Float32Array {
  const beat = 60 / bpm;
  const total = leadIn + melody.reduce((s, [, b]) => s + b * beat, 0) + 0.3;
  const out = new Float32Array(Math.ceil(total * sr));
  let t = leadIn;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (const [m, b] of melody) {
    const dur = b * beat;
    if (m !== null) {
      const f = midiToHz(m);
      const start = Math.floor(t * sr);
      const len = Math.floor((dur - detached) * sr);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.min(1, i / (0.01 * sr)) * Math.min(1, (len - i) / (0.01 * sr));
        ph += (2 * Math.PI * f) / sr;
        let v = 0;
        for (let h = 1; h <= 6; h++) v += Math.sin(ph * h) / h;
        out[start + i] += 0.3 * env * v + 0.002 * rnd();
      }
    }
    t += dur;
  }
  return out;
}
