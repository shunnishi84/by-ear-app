import { eventStartTicks, measureTicks, newId, rest, totalTicks } from './types';
import type { NoteEvent, TimeSig } from './types';

/**
 * Pure editing operations on the event list. Duration edits use "overwrite"
 * semantics like most notation editors (flat.io, MuseScore): the total length
 * of the score does not shift, following notes are consumed or rests appear.
 */

const clone = (e: NoteEvent): NoteEvent => ({ ...e, pitches: [...e.pitches] });

/** Pad the end with rests so the last measure is complete; drop empty events. */
export function normalize(events: NoteEvent[], ts: TimeSig): NoteEvent[] {
  const mt = measureTicks(ts);
  const out = events.filter((e) => e.ticks > 0);
  const total = totalTicks(out);
  const rem = total % mt;
  if (rem !== 0) out.push(rest(mt - rem));
  if (out.length === 0) out.push(rest(mt));
  // A tie into a rest (or out of the last event) means nothing.
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    if (out[i].tieNext && (!next || !next.pitches.some((p) => out[i].pitches.includes(p)))) {
      out[i] = { ...out[i], tieNext: false };
    }
  }
  return out;
}

/** Make sure an event boundary exists at `tick`, splitting (and tying) if needed. */
export function splitAt(events: NoteEvent[], tick: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  let t = 0;
  for (const e of events) {
    if (tick > t && tick < t + e.ticks) {
      const a = { ...clone(e), ticks: tick - t, tieNext: e.pitches.length > 0 ? true : undefined };
      const b = { ...clone(e), id: newId(), ticks: t + e.ticks - tick };
      out.push(a, b);
    } else out.push(e);
    t += e.ticks;
  }
  if (tick > t) out.push(rest(tick - t));
  return out;
}

/** Replace the time span [start, start+len) with `inserted` (whose ticks sum to len). */
export function replaceSpan(events: NoteEvent[], start: number, len: number, inserted: NoteEvent[]): NoteEvent[] {
  let ev = splitAt(splitAt(events, start), start + len);
  const starts = eventStartTicks(ev);
  const before: NoteEvent[] = [];
  const after: NoteEvent[] = [];
  ev.forEach((e, i) => {
    if (starts[i] < start) before.push(e);
    else if (starts[i] >= start + len) after.push(e);
  });
  ev = [...before, ...inserted, ...after];
  return ev;
}

export function setDuration(events: NoteEvent[], index: number, ticks: number, ts: TimeSig): NoteEvent[] {
  const e = events[index];
  if (!e || ticks <= 0 || ticks === e.ticks) return events;
  if (ticks < e.ticks) {
    const out = [...events];
    out.splice(index, 1, { ...e, ticks }, rest(e.ticks - ticks));
    if (e.tieNext) out[index] = { ...out[index], tieNext: false };
    return normalize(out, ts);
  }
  const start = eventStartTicks(events)[index];
  return normalize(replaceSpan(events, start, ticks, [{ ...e, ticks, tieNext: false }]), ts);
}

export function mapRange(
  events: NoteEvent[],
  from: number,
  to: number,
  fn: (e: NoteEvent) => NoteEvent,
): NoteEvent[] {
  return events.map((e, i) => (i >= from && i <= to ? fn(e) : e));
}

export const clampMidi = (m: number) => Math.max(21, Math.min(108, m));

export function transposeRange(events: NoteEvent[], from: number, to: number, semis: number): NoteEvent[] {
  return mapRange(events, from, to, (e) => ({ ...e, pitches: e.pitches.map((p) => clampMidi(p + semis)) }));
}

export function restRange(events: NoteEvent[], from: number, to: number, ts: TimeSig): NoteEvent[] {
  return normalize(
    mapRange(events, from, to, (e) => ({ ...e, pitches: [], tieNext: false })),
    ts,
  );
}

/** Remove events entirely; the following music moves earlier. */
export function removeRange(events: NoteEvent[], from: number, to: number, ts: TimeSig): NoteEvent[] {
  return normalize(events.filter((_, i) => i < from || i > to), ts);
}

/** Insert an event before `index`; the following music moves later. */
export function insertBefore(events: NoteEvent[], index: number, ev: NoteEvent, ts: TimeSig): NoteEvent[] {
  const out = [...events];
  out.splice(index, 0, ev);
  return normalize(out, ts);
}

export function appendMeasure(events: NoteEvent[], ts: TimeSig): NoteEvent[] {
  return normalize([...normalize(events, ts), rest(measureTicks(ts))], ts);
}

/** Delete the measure containing event `index`. */
export function deleteMeasureAt(events: NoteEvent[], index: number, ts: TimeSig): NoteEvent[] {
  const mt = measureTicks(ts);
  const m = Math.floor(eventStartTicks(events)[index] / mt);
  const total = totalTicks(events);
  if (total <= mt) return normalize([rest(mt)], ts);
  let ev = splitAt(splitAt(events, m * mt), (m + 1) * mt);
  const starts = eventStartTicks(ev);
  ev = ev.filter((_, i) => starts[i] < m * mt || starts[i] >= (m + 1) * mt);
  // Ties can't survive across the cut.
  const cutIdx = ev.findIndex((_, i) => eventStartTicks(ev)[i] >= m * mt) - 1;
  if (cutIdx >= 0) ev[cutIdx] = { ...ev[cutIdx], tieNext: false };
  return normalize(ev, ts);
}

/** Overwrite from event `index` onwards with `clip` (ids refreshed). */
export function pasteAt(events: NoteEvent[], index: number, clip: NoteEvent[], ts: TimeSig): NoteEvent[] {
  const start = eventStartTicks(events)[index] ?? totalTicks(events);
  const fresh = clip.map((e) => ({ ...clone(e), id: newId() }));
  const len = totalTicks(fresh);
  return normalize(replaceSpan(events, start, len, fresh), ts);
}

/** Change time signature while keeping the music (it simply re-bars). */
export const rebar = (events: NoteEvent[], ts: TimeSig): NoteEvent[] => normalize(events, ts);

/** Index of the event sounding at `tick`. */
export function eventAtTick(events: NoteEvent[], tick: number): number {
  let t = 0;
  for (let i = 0; i < events.length; i++) {
    if (tick < t + events[i].ticks) return i;
    t += events[i].ticks;
  }
  return events.length - 1;
}
