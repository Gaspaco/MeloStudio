import type { MediaClip } from "../types";

export const STUDIO_BAR_PX = 160;
export const BEATS_PER_BAR = 4;
export const STUDIO_BEAT_PX = STUDIO_BAR_PX / BEATS_PER_BAR;
export const REGION_EDGE_EPS_PX = 0.5;
export const MIN_REGION_PX = 2;

export type RegionEdge = "left" | "right";

export const barsToPx = (bars: number) => bars * STUDIO_BAR_PX;
export const pxToBars = (px: number) => px / STUDIO_BAR_PX;

export const clipLeftPx = (clip: MediaClip): number => clip.leftPx ?? barsToPx(clip.barStart);
export const clipWidthPx = (clip: MediaClip): number => clip.widthPx ?? barsToPx(clip.bars);
export const clipRightPx = (clip: MediaClip): number => clipLeftPx(clip) + clipWidthPx(clip);

export const placeClip = (
  clip: MediaClip,
  leftPx: number,
  widthPx: number,
  sourceOffsetBars = clip.sourceOffsetBars ?? 0,
): MediaClip => {
  const normalizedLeftPx = Math.max(0, leftPx);
  const normalizedWidthPx = Math.max(MIN_REGION_PX, widthPx);
  const bars = pxToBars(normalizedWidthPx);
  // Preserve the original clip extent so right-trim can always be recovered.
  // Only set it on the first placement — never shrink it.
  const originalBars = Math.max(clip.originalBars ?? bars, bars);
  return {
    ...clip,
    leftPx: normalizedLeftPx,
    widthPx: normalizedWidthPx,
    barStart: pxToBars(normalizedLeftPx),
    bars,
    originalBars,
    sourceOffsetBars: Math.max(0, sourceOffsetBars),
  };
};

export const sortClipsByTimeline = (clips: MediaClip[]): MediaClip[] =>
  [...clips].sort((a, b) => clipLeftPx(a) - clipLeftPx(b));

export const rangesOverlap = (leftA: number, rightA: number, leftB: number, rightB: number): boolean =>
  leftA < rightB - REGION_EDGE_EPS_PX && rightA > leftB + REGION_EDGE_EPS_PX;

export const resolveRegionOverwrite = (clips: MediaClip[], placedClip: MediaClip, createId: () => string): MediaClip[] => {
  const movedLeftPx = clipLeftPx(placedClip);
  const movedWidthPx = clipWidthPx(placedClip);
  const movedRightPx = movedLeftPx + movedWidthPx;
  const resolved: MediaClip[] = [];

  for (const clip of clips) {
    if (clip.id === placedClip.id) continue;

    const leftPx = clipLeftPx(clip);
    const widthPx = clipWidthPx(clip);
    const rightPx = leftPx + widthPx;

    if (!rangesOverlap(leftPx, rightPx, movedLeftPx, movedRightPx)) {
      resolved.push(clip);
      continue;
    }

    const sourceOffsetBars = clip.sourceOffsetBars ?? 0;
    const leftRemainderPx = Math.max(0, movedLeftPx - leftPx);
    const rightRemainderPx = Math.max(0, rightPx - movedRightPx);

    if (leftRemainderPx >= MIN_REGION_PX) {
      resolved.push(placeClip(clip, leftPx, leftRemainderPx, sourceOffsetBars));
    }

    if (rightRemainderPx >= MIN_REGION_PX) {
      const cutFromStartPx = Math.max(0, movedRightPx - leftPx);
      resolved.push(placeClip(
        { ...clip, id: createId() },
        movedRightPx,
        rightRemainderPx,
        sourceOffsetBars + pxToBars(cutFromStartPx),
      ));
    }
  }

  resolved.push(placedClip);
  return sortClipsByTimeline(resolved);
};

export const moveRegionToPx = (clips: MediaClip[], clipId: string, leftPx: number, createId: () => string): MediaClip[] => {
  const movingClip = clips.find((clip) => clip.id === clipId);
  if (!movingClip) return clips;
  const placedClip = placeClip(movingClip, leftPx, clipWidthPx(movingClip));
  return resolveRegionOverwrite(clips, placedClip, createId);
};

export const splitRegionAtPx = (clips: MediaClip[], clipId: string, splitPx: number, createId: () => string): MediaClip[] => {
  const clip = clips.find((item) => item.id === clipId);
  if (!clip) return clips;

  const leftPx = clipLeftPx(clip);
  const rightPx = clipRightPx(clip);
  const normalizedSplitPx = Math.max(leftPx, Math.min(rightPx, splitPx));
  if (normalizedSplitPx <= leftPx + REGION_EDGE_EPS_PX || normalizedSplitPx >= rightPx - REGION_EDGE_EPS_PX) {
    return clips;
  }

  const sourceOffsetBars = clip.sourceOffsetBars ?? 0;
  const leftWidthPx = normalizedSplitPx - leftPx;
  const rightWidthPx = rightPx - normalizedSplitPx;
  const leftClip = placeClip(clip, leftPx, leftWidthPx, sourceOffsetBars);
  const rightClip = placeClip(
    {
      ...clip,
      id: createId(),
      name: `${clip.name} Split`,
    },
    normalizedSplitPx,
    rightWidthPx,
    sourceOffsetBars + pxToBars(leftWidthPx),
  );

  return sortClipsByTimeline(clips.flatMap((item) => item.id === clipId ? [leftClip, rightClip] : [item]));
};

// Clip a MIDI clip's notes to its (possibly trimmed) bounds. `shiftBars` is how
// far the clip's start moved (left-trim > 0). Notes are repositioned into the
// new clip-relative space, then clamped to [0, bars]: a note crossing an edge is
// shortened to exactly the edge, a note fully outside is dropped. Notes wholly
// inside the region are left untouched — so trimming adheres to the exact edge
// instead of deleting whole notes.
const clipMidiNotesToBounds = (clip: MediaClip, shiftBars: number): MediaClip => {
  if (!clip.midiNotes?.length) return clip;
  const bars = clip.bars;
  const EPS = 1e-4;
  const midiNotes = [];
  for (const note of clip.midiNotes) {
    const start = note.startBars - shiftBars;
    const end = start + note.durationBars;
    const clippedStart = Math.max(0, start);
    const clippedEnd = Math.min(bars, end);
    if (clippedEnd - clippedStart > EPS) {
      midiNotes.push({ ...note, startBars: clippedStart, durationBars: clippedEnd - clippedStart });
    }
  }
  return { ...clip, midiNotes };
};

export const trimRegionEdge = (
  clips: MediaClip[],
  clipId: string,
  edge: RegionEdge,
  targetPx: number,
  _createId: () => string,
): MediaClip[] => {
  const clip = clips.find((item) => item.id === clipId);
  if (!clip) return clips;

  const originalLeftPx = clipLeftPx(clip);
  const originalRightPx = clipRightPx(clip);
  const sourceOffsetPx = barsToPx(clip.sourceOffsetBars ?? 0);
  // The maximum right boundary is the original clip extent plus the current left position.
  // This allows right-trim expansion to recover original material non-destructively.
  const maxRightPx = originalLeftPx + barsToPx(clip.originalBars ?? clip.bars);

  let trimmed: MediaClip;
  if (edge === "left") {
    // Left trim: can move left back to where sourceOffset allows (recovers trimmed start material)
    const earliestLeftPx = Math.max(0, originalLeftPx - sourceOffsetPx);
    const newLeftPx = Math.max(earliestLeftPx, Math.min(targetPx, originalRightPx - MIN_REGION_PX));
    const newWidthPx = originalRightPx - newLeftPx;
    const shiftBars = pxToBars(newLeftPx - originalLeftPx);
    const newSourceOffsetBars = (clip.sourceOffsetBars ?? 0) + shiftBars;
    trimmed = clipMidiNotesToBounds(placeClip(clip, newLeftPx, newWidthPx, newSourceOffsetBars), shiftBars);
  } else {
    // Right trim: can expand back to the original clip length (non-destructive recovery)
    const newRightPx = Math.max(originalLeftPx + MIN_REGION_PX, Math.min(targetPx, maxRightPx));
    trimmed = clipMidiNotesToBounds(placeClip(clip, originalLeftPx, newRightPx - originalLeftPx), 0);
  }

  // Trimming only resizes the dragged clip — it must never cut neighbouring
  // clips (that's the drag-drop overwrite path), which is what made trimming
  // feel destructive.
  return sortClipsByTimeline(clips.map((item) => (item.id === clipId ? trimmed : item)));
};

export const snapMoveLeftPx = (
  clips: MediaClip[],
  movingClipId: string,
  desiredLeftPx: number,
  widthPx: number,
  gridPx = STUDIO_BEAT_PX,
  edgeSnapPx = 12,
): number => {
  const gridLeftPx = Math.max(0, Math.round(desiredLeftPx / gridPx) * gridPx);
  let bestLeftPx = gridLeftPx;
  let bestDistance = Math.abs(desiredLeftPx - gridLeftPx);

  for (const clip of clips) {
    if (clip.id === movingClipId) continue;
    const leftPx = clipLeftPx(clip);
    const rightPx = clipRightPx(clip);
    for (const candidate of [leftPx - widthPx, rightPx]) {
      const normalized = Math.max(0, candidate);
      const distance = Math.abs(desiredLeftPx - normalized);
      if (distance <= edgeSnapPx && distance < bestDistance) {
        bestLeftPx = normalized;
        bestDistance = distance;
      }
    }
  }

  return bestLeftPx;
};

export const snapRegionEdgePx = (
  clips: MediaClip[],
  movingClipId: string,
  desiredEdgePx: number,
  gridPx = STUDIO_BEAT_PX,
  edgeSnapPx = 12,
): number => {
  const gridEdgePx = Math.max(0, Math.round(desiredEdgePx / gridPx) * gridPx);
  let bestEdgePx = gridEdgePx;
  let bestDistance = Math.abs(desiredEdgePx - gridEdgePx);

  for (const clip of clips) {
    if (clip.id === movingClipId) continue;
    for (const candidate of [clipLeftPx(clip), clipRightPx(clip)]) {
      const distance = Math.abs(desiredEdgePx - candidate);
      if (distance <= edgeSnapPx && distance < bestDistance) {
        bestEdgePx = candidate;
        bestDistance = distance;
      }
    }
  }

  return bestEdgePx;
};
