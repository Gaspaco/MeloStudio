// BPM ↔ seconds conversion. Pure functions; no Web Audio dependency.
export const beatsToSec = (beats: number, bpm: number): number =>
  (beats * 60) / bpm;

export const secToBeats = (sec: number, bpm: number): number =>
  (sec * bpm) / 60;

/** Snap project-time seconds to the nearest grid division (e.g. 1/16 note). */
export function snapSec(sec: number, bpm: number, division = 16): number {
  const stepSec = beatsToSec(4 / division, bpm); // 4/16 = 1/4 note's fraction
  return Math.round(sec / stepSec) * stepSec;
}

/** Bar/beat label for the transport readout. */
export function formatBarBeat(
  sec: number,
  bpm: number,
  timeSig: [number, number] = [4, 4],
): string {
  const beats = secToBeats(sec, bpm);
  const beatsPerBar = timeSig[0];
  const bar = Math.floor(beats / beatsPerBar) + 1;
  const beat = Math.floor(beats % beatsPerBar) + 1;
  const sub = Math.floor((beats % 1) * 4) + 1; // 1/16
  return `${bar}.${beat}.${sub}`;
}
