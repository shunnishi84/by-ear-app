import type { RawNote } from './notes';

/**
 * Polyphonic transcription with Spotify's Basic Pitch model (TensorFlow.js).
 * The library and model are only loaded when this mode is used.
 */
export async function polyphonicNotes(samples: Float32Array, onProgress: (r: number) => void): Promise<RawNote[]> {
  const { BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import('@spotify/basic-pitch');
  const modelUrl = new URL('models/basic-pitch/model.json', document.baseURI).href;
  const bp = new BasicPitch(modelUrl);
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  await bp.evaluateModel(
    samples,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    onProgress,
  );
  const events = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.5, 0.3, 11)));
  const notes: RawNote[] = events
    .map((n) => ({
      start: n.startTimeSeconds,
      end: n.startTimeSeconds + n.durationSeconds,
      midi: n.pitchMidi,
      velocity: n.amplitude,
    }))
    .sort((a, b) => a.start - b.start);
  return cleanPolyNotes(notes);
}

/** Intervals (semitones) at which overtones of a lower note appear. */
const OVERTONES = [12, 19, 24, 28, 31];

/**
 * Drop likely false positives: very quiet notes, and notes that sit on an
 * overtone of a louder note struck at the same moment.
 */
export function cleanPolyNotes(notes: RawNote[]): RawNote[] {
  if (!notes.length) return notes;
  const amps = notes.map((n) => n.velocity).sort((a, b) => a - b);
  const loud = amps[Math.floor(amps.length * 0.9)];
  return notes.filter((n) => {
    if (n.velocity < loud * 0.25) return false;
    return !notes.some(
      (m) =>
        m !== n &&
        OVERTONES.includes(n.midi - m.midi) &&
        Math.abs(m.start - n.start) < 0.08 &&
        n.velocity < m.velocity * (n.midi - m.midi === 12 ? 0.6 : 0.9),
    );
  });
}
