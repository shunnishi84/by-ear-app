/** A detected note in seconds, before rhythm quantisation. */
export interface RawNote {
  start: number;
  end: number;
  midi: number;
  /** Rough loudness 0..1 */
  velocity: number;
}

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
