import { TPQ } from './types';
import type { KeyMode } from './types';

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
/** Order in which sharps (and reversed: flats) are added to key signatures. */
const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

export interface Spelled {
  letter: Letter;
  /** -2..2 */
  alter: number;
  octave: number;
}

/** Accidental each letter carries under a key signature. */
export function keyAlterations(fifths: number): Record<Letter, number> {
  const alt = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 } as Record<Letter, number>;
  if (fifths > 0) for (let i = 0; i < Math.min(fifths, 7); i++) alt[SHARP_ORDER[i]] = 1;
  if (fifths < 0) for (let i = 0; i < Math.min(-fifths, 7); i++) alt[SHARP_ORDER[6 - i]] = -1;
  return alt;
}

/** Spell a MIDI number so that it fits the key (diatonic first, then sharps/flats by key side). */
export function spell(midi: number, fifths: number): Spelled {
  const alt = keyAlterations(fifths);
  const pc = ((midi % 12) + 12) % 12;
  // Diatonic in this key?
  for (let i = 0; i < 7; i++) {
    const l = LETTERS[i];
    if ((((LETTER_PC[i] + alt[l]) % 12) + 12) % 12 === pc) {
      return fromLetter(midi, l, alt[l]);
    }
  }
  // Chromatic: prefer sharps in sharp/C keys, flats in flat keys.
  const preferFlat = fifths < 0;
  for (let i = 0; i < 7; i++) {
    const l = LETTERS[i];
    const a = preferFlat ? -1 : 1;
    if ((((LETTER_PC[i] + a) % 12) + 12) % 12 === pc) return fromLetter(midi, l, a);
  }
  for (let i = 0; i < 7; i++) {
    const l = LETTERS[i];
    if (LETTER_PC[i] === pc) return fromLetter(midi, l, 0);
  }
  throw new Error('unreachable');
}

function fromLetter(midi: number, letter: Letter, alter: number): Spelled {
  const basePc = LETTER_PC[LETTERS.indexOf(letter)];
  const octave = Math.round((midi - alter - basePc) / 12) - 1;
  return { letter, alter, octave };
}

export const spelledToMidi = (s: Spelled): number =>
  (s.octave + 1) * 12 + LETTER_PC[LETTERS.indexOf(s.letter)] + s.alter;

/** Diatonic index: octave*7 + letter index (C4 = 28). */
export const diatonicIndex = (s: Spelled): number => s.octave * 7 + LETTERS.indexOf(s.letter);

/** MIDI of the diatonic step `d` with the key signature applied. */
export function midiFromDiatonic(d: number, fifths: number): number {
  const octave = Math.floor(d / 7);
  const letter = LETTERS[((d % 7) + 7) % 7];
  return spelledToMidi({ letter, alter: keyAlterations(fifths)[letter], octave });
}

/** Pitch of `letter` (with key signature) in the octave closest to `near`. */
export function letterNear(letter: Letter, fifths: number, near: number): number {
  const alt = keyAlterations(fifths)[letter];
  const pc = LETTER_PC[LETTERS.indexOf(letter)] + alt;
  let best = pc + 60;
  for (let oct = -1; oct <= 9; oct++) {
    const m = pc + (oct + 1) * 12;
    if (Math.abs(m - near) < Math.abs(best - near)) best = m;
  }
  return best;
}

const ACC_TEXT: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };
export const pitchName = (midi: number, fifths: number): string => {
  const s = spell(midi, fifths);
  return `${s.letter}${ACC_TEXT[s.alter]}${s.octave}`;
};

/** Normalise a fifths value to the -6..6 range (enharmonic key choice). */
export function normalizeFifths(f: number): number {
  let x = ((f % 12) + 12) % 12; // 0..11
  if (x > 6) x -= 12; // -5..6
  return x;
}

/** Key signature seen by the player of a transposing instrument. */
export const writtenFifths = (concertFifths: number, transpose: number): number =>
  transpose === 0 ? concertFifths : normalizeFifths(concertFifths + 7 * transpose);

const MAJOR_NAMES_JA: Record<number, string> = {
  [-7]: '変ハ長調', [-6]: '変ト長調', [-5]: '変ニ長調', [-4]: '変イ長調', [-3]: '変ホ長調',
  [-2]: '変ロ長調', [-1]: 'ヘ長調', 0: 'ハ長調', 1: 'ト長調', 2: 'ニ長調', 3: 'イ長調',
  4: 'ホ長調', 5: 'ロ長調', 6: '嬰ヘ長調', 7: '嬰ハ長調',
};
const MINOR_NAMES_JA: Record<number, string> = {
  [-7]: '変イ短調', [-6]: '変ホ短調', [-5]: '変ロ短調', [-4]: 'ヘ短調', [-3]: 'ハ短調',
  [-2]: 'ト短調', [-1]: 'ニ短調', 0: 'イ短調', 1: 'ホ短調', 2: 'ロ短調', 3: '嬰ヘ短調',
  4: '嬰ハ短調', 5: '嬰ト短調', 6: '嬰ニ短調', 7: '嬰イ短調',
};
export const keyNameJa = (fifths: number, mode: KeyMode): string =>
  (mode === 'minor' ? MINOR_NAMES_JA : MAJOR_NAMES_JA)[fifths] ?? '';

// ---------------------------------------------------------------- durations

export type DurKey = 'w' | 'h' | 'q' | '8' | '16' | '32';
export const DUR_TICKS: Record<DurKey, number> = {
  w: TPQ * 4,
  h: TPQ * 2,
  q: TPQ,
  '8': TPQ / 2,
  '16': TPQ / 4,
  '32': TPQ / 8,
};
export const DUR_ORDER: DurKey[] = ['w', 'h', 'q', '8', '16', '32'];

export interface NoteValue {
  dur: DurKey;
  dots: 0 | 1;
  ticks: number;
}

/** All single note values (plain and dotted), longest first. */
export const NOTE_VALUES: NoteValue[] = DUR_ORDER.flatMap((d): NoteValue[] => {
  const t = DUR_TICKS[d];
  const plain: NoteValue = { dur: d, dots: 0, ticks: t };
  return t % 2 === 0 ? [{ dur: d, dots: 1, ticks: (t * 3) / 2 }, plain] : [plain];
}).sort((a, b) => b.ticks - a.ticks);

export const valueForTicks = (ticks: number): NoteValue | undefined =>
  NOTE_VALUES.find((v) => v.ticks === ticks);

/** Length of one beat for beaming / splitting purposes (compound meters use dotted beats). */
export const beatTicksFor = (num: number, den: number): number =>
  den === 8 && num % 3 === 0 && num > 3 ? (TPQ / 2) * 3 : (TPQ * 4) / den;

/**
 * Split a span of `ticks` starting at `pos` (ticks from the start of the
 * measure) into writable note values, longest first. Values up to a beat may
 * not cross a beat boundary; longer values must start on a beat. This keeps
 * the beat visible, like a hand-engraved part.
 */
export function decompose(pos: number, ticks: number, beatTicks: number): NoteValue[] {
  const out: NoteValue[] = [];
  let p = pos;
  let left = ticks;
  while (left > 0) {
    const chosen =
      NOTE_VALUES.find((v) => {
        if (v.ticks > left) return false;
        if (v.ticks <= beatTicks) return Math.floor(p / beatTicks) === Math.floor((p + v.ticks - 1) / beatTicks);
        return p % beatTicks === 0;
      }) ?? NOTE_VALUES[NOTE_VALUES.length - 1];
    out.push(chosen);
    p += chosen.ticks;
    left -= chosen.ticks;
  }
  return out;
}

// ---------------------------------------------------------------- key detection

const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Tonic pitch class -> fifths for major keys (flats preferred for 1,3,8,10, F# for 6). */
const MAJOR_FIFTHS_BY_PC = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

/** Krumhansl–Schmuckler key finding on (midi, weight) pairs. */
export function detectKey(notes: { midi: number; weight: number }[]): { fifths: number; mode: KeyMode } {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[((n.midi % 12) + 12) % 12] += n.weight;
  if (hist.every((x) => x === 0)) return { fifths: 0, mode: 'major' };
  let best = { score: -Infinity, fifths: 0, mode: 'major' as KeyMode };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - tonic + 12) % 12]);
    const maj = correlation(hist, rot(KK_MAJOR));
    const min = correlation(hist, rot(KK_MINOR));
    if (maj > best.score) best = { score: maj, fifths: MAJOR_FIFTHS_BY_PC[tonic], mode: 'major' };
    if (min > best.score) best = { score: min, fifths: MAJOR_FIFTHS_BY_PC[(tonic + 3) % 12], mode: 'minor' };
  }
  return { fifths: best.fifths, mode: best.mode };
}
