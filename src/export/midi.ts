import { soundingNotes } from '../audio/player';
import { TPQ } from '../model/types';
import type { Score } from '../model/types';

const PROGRAM: Record<Score['instrument'], number> = { piano: 0, trumpet: 56, steelpan: 114, flute: 73, organ: 19 };

function vlq(n: number): number[] {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

/** Standard MIDI File (format 0) at concert pitch. */
export function toMidi(score: Score): Uint8Array<ArrayBuffer> {
  const PPQ = 480;
  const scale = PPQ / TPQ;
  const evs: { t: number; data: number[] }[] = [];
  const usPerQ = Math.round(60_000_000 / score.tempo);
  evs.push({ t: 0, data: [0xff, 0x51, 0x03, (usPerQ >> 16) & 0xff, (usPerQ >> 8) & 0xff, usPerQ & 0xff] });
  const den = Math.log2(score.timeSig.den);
  evs.push({ t: 0, data: [0xff, 0x58, 0x04, score.timeSig.num, den, 24, 8] });
  const title = new TextEncoder().encode(score.title);
  evs.push({ t: 0, data: [0xff, 0x03, ...vlq(title.length), ...title] });
  evs.push({ t: 0, data: [0xc0, PROGRAM[score.instrument]] });
  for (const n of soundingNotes(score)) {
    evs.push({ t: n.start * scale, data: [0x90, n.midi, 90] });
    evs.push({ t: n.end * scale, data: [0x80, n.midi, 0] });
  }
  // Note-offs before note-ons at the same time.
  evs.sort((a, b) => a.t - b.t || (a.data[0] === 0x80 ? -1 : 0) - (b.data[0] === 0x80 ? -1 : 0));
  const track: number[] = [];
  let last = 0;
  for (const e of evs) {
    track.push(...vlq(e.t - last), ...e.data);
    last = e.t;
  }
  track.push(0, 0xff, 0x2f, 0x00);
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  const len = track.length;
  return new Uint8Array([
    ...header,
    0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...track,
  ]);
}
