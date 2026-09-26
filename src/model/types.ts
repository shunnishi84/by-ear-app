/** Ticks per quarter note. 1 tick = a 32nd note. */
export const TPQ = 8;

export type Clef = 'treble' | 'bass';
export type KeyMode = 'major' | 'minor';
export type InstrumentId = 'piano' | 'trumpet' | 'steelpan' | 'flute' | 'organ';

/**
 * One rhythmic event of the (single) voice. `pitches` holds concert-pitch MIDI
 * numbers; an empty array is a rest, several pitches form a chord.
 */
export interface NoteEvent {
  id: string;
  pitches: number[];
  ticks: number;
  /** Pitches shared with the following event are tied into it. */
  tieNext?: boolean;
}

export interface TimeSig {
  num: number;
  den: number;
}

/** How the score lines up with the audio it was transcribed from. */
export interface AudioAlignment {
  /** Seconds into the source audio where tick 0 falls. */
  offsetSec: number;
  /** Tempo (BPM) the transcription grid was built with. */
  tempo: number;
  fileName?: string;
}

export interface Score {
  title: string;
  composer: string;
  tempo: number;
  timeSig: TimeSig;
  /** Concert key signature, -7..7 (negative = flats). */
  keyFifths: number;
  keyMode: KeyMode;
  clef: Clef;
  /** Written = concert + transpose (semitones). B♭ trumpet = +2. */
  transpose: number;
  instrument: InstrumentId;
  events: NoteEvent[];
  audio?: AudioAlignment;
}

export const measureTicks = (ts: TimeSig): number => (ts.num * TPQ * 4) / ts.den;

let idCounter = 0;
export const newId = (): string =>
  `e${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const rest = (ticks: number): NoteEvent => ({ id: newId(), pitches: [], ticks });
export const note = (pitches: number[], ticks: number): NoteEvent => ({ id: newId(), pitches, ticks });

export function emptyScore(): Score {
  const ts = { num: 4, den: 4 };
  const mt = measureTicks(ts);
  return {
    title: '無題',
    composer: '',
    tempo: 120,
    timeSig: ts,
    keyFifths: 0,
    keyMode: 'major',
    clef: 'treble',
    transpose: 0,
    instrument: 'piano',
    events: Array.from({ length: 4 }, () => rest(mt)),
  };
}

export const eventStartTicks = (events: NoteEvent[]): number[] => {
  const out: number[] = [];
  let t = 0;
  for (const e of events) {
    out.push(t);
    t += e.ticks;
  }
  return out;
};

export const totalTicks = (events: NoteEvent[]): number => events.reduce((s, e) => s + e.ticks, 0);
