import type { Clef, InstrumentId } from './types';

export interface InstrumentPreset {
  id: string;
  label: string;
  /** Written = concert + transpose. */
  transpose: number;
  minMidi: number;
  maxMidi: number;
  clef: Clef | 'auto';
  sound: InstrumentId;
}

/** Concert-pitch ranges are generous on purpose: detection outside them is dropped. */
export const PRESETS: InstrumentPreset[] = [
  { id: 'concert', label: 'C（実音・汎用）', transpose: 0, minMidi: 36, maxMidi: 96, clef: 'auto', sound: 'piano' },
  { id: 'bb-trumpet', label: 'B♭ トランペット', transpose: 2, minMidi: 52, maxMidi: 86, clef: 'treble', sound: 'trumpet' },
  { id: 'steelpan', label: 'スティールパン（テナー）', transpose: 0, minMidi: 57, maxMidi: 93, clef: 'treble', sound: 'steelpan' },
  { id: 'eb-alto', label: 'E♭ アルトサックス', transpose: 9, minMidi: 49, maxMidi: 81, clef: 'treble', sound: 'flute' },
  { id: 'f-horn', label: 'F ホルン', transpose: 7, minMidi: 34, maxMidi: 77, clef: 'treble', sound: 'trumpet' },
  { id: 'voice', label: '歌・メロディ', transpose: 0, minMidi: 45, maxMidi: 84, clef: 'auto', sound: 'flute' },
  { id: 'bass', label: 'ヘ音記号（ベース・トロンボーン）', transpose: 0, minMidi: 28, maxMidi: 67, clef: 'bass', sound: 'piano' },
];

export const TRANSPOSE_OPTIONS = [
  { value: 0, label: 'C（実音）' },
  { value: 2, label: 'B♭（トランペット・クラリネット等）' },
  { value: 9, label: 'E♭（アルトサックス等）' },
  { value: 7, label: 'F（ホルン等）' },
  { value: 14, label: 'B♭ テナーサックス（+9度）' },
];
