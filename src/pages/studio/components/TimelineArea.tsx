import { type Component, For, Show, createMemo, createEffect, createSignal, onMount, onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { MicVocal, FileMusic } from "lucide-solid";
import { type ClipKind, type TrackType, type UITrack, TEMPLATES, isTrackAllowedForClip, isTrackTypeAllowedForClipKind } from "../types";
import type { StepPattern } from "~/lib/audio/stepSeq";
import type { MediaClip } from "../types";
import type { MidiNoteEvent } from "../types";
import AudioWaveformDisplay from "./AudioWaveformDisplay";
import LiveRecordingClip from "./LiveRecordingClip";
import {
  MIN_REGION_PX,
  STUDIO_BAR_PX,
  clipLeftPx,
  clipRightPx,
  clipWidthPx,
  pxToBars,
  snapMoveLeftPx,
  snapRegionEdgePx,
  type RegionEdge,
} from "../lib/regionMath";

type ClipCtxMenu = { x: number; y: number; trackId: string; clipId: string; clipName: string; renaming?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MEDIA_ICON_MAP: Record<string, Component<any>> = { audio: MicVocal, midi: FileMusic, video: MicVocal };
const MediaClipIcon: Component<{ kind: string }> = (props) => {
  const Icon = MEDIA_ICON_MAP[props.kind];
  return Icon ? <Icon size={11} stroke-width={1.6} aria-hidden="true" /> : null;
};

const MIDI_OVERVIEW_MIN_ROWS = 12;
const MIDI_NOTE_ROW_FILL = 0.68;

const MidiNotesOverview: Component<{ clip: MediaClip }> = (props) => {
  const notes = () => props.clip.midiNotes ?? [];
  const displayNotes = createMemo(() => {
    const sorted = notes()
      .filter((note) =>
        Number.isFinite(note.midi)
        && Number.isFinite(note.startBars)
        && Number.isFinite(note.durationBars)
        && note.durationBars > 0
      )
      .map((note) => ({
        ...note,
        midi: Math.max(0, Math.min(127, Math.round(note.midi))),
        startBars: Math.max(0, note.startBars),
        durationBars: Math.max(0.001, note.durationBars),
      }))
      .sort((a, b) => a.midi - b.midi || a.startBars - b.startBars);

    const merged: typeof sorted = [];
    for (const note of sorted) {
      const previous = merged.at(-1);
      const previousEnd = previous ? previous.startBars + previous.durationBars : -1;
      if (previous?.midi === note.midi && note.startBars <= previousEnd + 0.001) {
        previous.durationBars = Math.max(previousEnd, note.startBars + note.durationBars) - previous.startBars;
        previous.velocity = Math.max(previous.velocity, note.velocity);
      } else {
        merged.push({ ...note });
      }
    }
    return merged;
  });
  const displaySpanBars = createMemo(() =>
    Math.max(
      0.001,
      ...displayNotes().map((note) => note.startBars + note.durationBars),
    )
  );
  const pitchBounds = createMemo(() => {
    const values = displayNotes().map((note) => note.midi);
    if (values.length === 0) return { min: 54, max: 65, rows: MIDI_OVERVIEW_MIN_ROWS };

    let min = Math.max(0, Math.min(...values) - 1);
    let max = Math.min(127, Math.max(...values) + 1);
    const missingRows = MIDI_OVERVIEW_MIN_ROWS - (max - min + 1);

    if (missingRows > 0) {
      min -= Math.floor(missingRows / 2);
      max += Math.ceil(missingRows / 2);
      if (min < 0) {
        max = Math.min(127, max - min);
        min = 0;
      }
      if (max > 127) {
        min = Math.max(0, min - (max - 127));
        max = 127;
      }
    }

    return { min, max, rows: max - min + 1 };
  });
  const noteTop = (midi: number) => {
    const bounds = pitchBounds();
    const clamped = Math.max(bounds.min, Math.min(bounds.max, midi));
    const row = bounds.max - clamped;
    const inset = (1 - MIDI_NOTE_ROW_FILL) / 2;
    return `${((row + inset) / bounds.rows) * 100}%`;
  };
  const noteHeight = () => `${(MIDI_NOTE_ROW_FILL / pitchBounds().rows) * 100}%`;
  const noteLeftPercent = (startBars: number) =>
    Math.max(0, Math.min(100, (startBars / displaySpanBars()) * 100));
  const noteWidthPercent = (startBars: number, durationBars: number) => {
    const left = noteLeftPercent(startBars);
    const requested = (Math.max(0, durationBars) / displaySpanBars()) * 100;
    return Math.max(0, Math.min(requested, 100 - left));
  };

  return (
    <div class="bl__midi-notes" style={{ "--mbars": `${Math.max(1, Math.round(props.clip.bars))}` }}>
      <Show when={displayNotes().length > 0} fallback={<div class="bl__midi-empty-grid" />}>
        <For each={displayNotes()}>
          {(note) => (
            <span
              class="bl__midi-note"
              style={{
                left: `${noteLeftPercent(note.startBars)}%`,
                width: `${noteWidthPercent(note.startBars, note.durationBars)}%`,
                top: noteTop(note.midi),
                height: noteHeight(),
                opacity: `${0.55 + Math.max(0, Math.min(1, note.velocity)) * 0.4}`,
              }}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

const LiveMidiRecordingClip: Component<{
  startPx: number;
  endPx: Accessor<number>;
  takeBars: Accessor<number>;
  notes: Accessor<Array<MidiNoteEvent & { active?: boolean }>>;
  color: string;
}> = (props) => {
  const widthPx = () => Math.max(8, props.endPx() - props.startPx);
  return (
    <div
      class="bl__live-midi-clip"
      style={{
        left: `${props.startPx}px`,
        width: `${widthPx()}px`,
        "--tc": props.color,
      }}
    >
      <For each={props.notes()}>
        {(note) => (
          <span
            class={`bl__live-midi-note${note.active ? " is-active" : ""}`}
            style={{
              left: `${Math.max(0, note.startBars / props.takeBars()) * 100}%`,
              width: `${Math.max(0.5, note.durationBars / props.takeBars() * 100)}%`,
              top: `${Math.max(4, Math.min(88, 88 - ((note.midi - 36) / 48) * 80))}%`,
              opacity: `${0.55 + note.velocity * 0.4}`,
            }}
          />
        )}
      </For>
    </div>
  );
};

const BAR_PX = STUDIO_BAR_PX;
const EDGE_SNAP_PX = 12;

type DraggedClipState = {
  clipId: string;
  barStart: number;
  leftPx: number;
  snappedLeftPx: number;
  widthPx: number;
  targetPx: number;
  sourceTrackId: string;
  targetTrackId: string;
  deltaY: number;
};

type Props = {
  tracks: Accessor<UITrack[]>;
  selectedTrack: Accessor<string | null>;
  pattern: Accessor<StepPattern>;
  playheadPx: Accessor<number>;
  setPlayheadPx: Setter<number>;
  selectedClipId: Accessor<string | null>;
  timeSignature: Accessor<[number, number]>;
  horizontalZoom: Accessor<number>;
  verticalZoom: Accessor<number>;
  onHorizontalZoom: (value: number) => void;
  onVerticalZoom: (value: number) => void;
  onSeek: (px: number) => void | Promise<void>;
  dropTarget: Accessor<{ trackId: string; bar: number } | null>;
  globalDragOver: Accessor<boolean>;
  onLaneDragOver: (e: DragEvent, trackId: string) => void;
  onLaneDragLeave: (e: DragEvent) => void;
  onLaneDrop: (e: DragEvent, trackId: string) => Promise<void>;
  onLanesDragOver: (e: DragEvent) => void;
  onLanesDragLeave: (e: DragEvent) => void;
  onLanesDrop: (e: DragEvent) => Promise<void>;
  onDeleteClip: (trackId: string, clipId: string) => void;
  onMoveClip: (trackId: string, clipId: string, newBarStart: number) => void;
  onMoveClipToTrack: (sourceTrackId: string, clipId: string, targetTrackId: string, newBarStart: number) => void;
  onTrimClip: (trackId: string, clipId: string, edge: RegionEdge, targetPx: number) => void;
  onSplitClip: (trackId: string, clipId: string, playheadPx: number) => void;
  onRenameClip: (trackId: string, clipId: string, name: string) => void;
  onDuplicateClip: (trackId: string, clipId: string) => void;
  onCreateRegion: (trackId: string, barStart: number) => void;
  onApplyTemplate: (templateId: string) => void;
  onImportFiles: (files: File[]) => Promise<void>;
  onAddTrack: (type: TrackType, openModal?: boolean) => void;
  onShowNewTrack: () => void;
  recordingTrackId: Accessor<string | null>;
  recordingStartPx: Accessor<number>;
  recordingEndPx: Accessor<number>;
  recordingMode: Accessor<"audio" | "midi" | null>;
  liveMidiNotes: Accessor<Array<MidiNoteEvent & { active?: boolean }>>;
  cycleEnabled: Accessor<boolean>;
  cycleStartPx: Accessor<number>;
  cycleEndPx: Accessor<number>;
  onSetCycle: (startPx: number, endPx: number, activate?: boolean) => void;
  onToggleCycle: () => void;
  onSelectClip: (trackId: string, clipId: string) => void;
  verticalScrollTop: Accessor<number>;
  onVerticalScroll: (scrollTop: number) => void;
};

const TimelineArea: Component<Props> = (props) => {
  let timelineEl: HTMLDivElement | undefined;
  let dragState: { x: number; scroll: number } | null = null;
  let renameInputEl: HTMLInputElement | undefined;
  let playheadDragState: { startX: number; startPx: number } | null = null;
  let cycleDragState: { mode: "move" | "left" | "right"; startX: number; startPx: number; endPx: number; moved: boolean } | null = null;
  let importInputEl: HTMLInputElement | undefined;

  const timelineBarCount = createMemo(() => {
    const clipEndBars = props.tracks().reduce((max, track) => {
      const trackEnd = (track.clips ?? []).reduce(
        (clipMax, clip) => Math.max(clipMax, Math.ceil(clipRightPx(clip) / BAR_PX)),
        0,
      );
      return Math.max(max, trackEnd);
    }, 0);
    const drumEndBars = props.tracks().reduce((max, track) => {
      if (track.type !== "drum") return max;
      const trackEnd = (track.clips ?? []).reduce(
        (clipMax, clip) => clip.drumPattern ? Math.max(clipMax, Math.ceil(clipRightPx(clip) / BAR_PX)) : clipMax,
        0,
      );
      return Math.max(max, trackEnd);
    }, 0);
    const playheadEndBars = Math.ceil(props.playheadPx() / BAR_PX);
    const cycleEndBars = Math.ceil(props.cycleEndPx() / BAR_PX);
    const requiredBars = Math.max(24, clipEndBars, drumEndBars, playheadEndBars, cycleEndBars) + 8;
    return Math.min(128, Math.ceil(requiredBars / 8) * 8);
  });
  const timelineBars = createMemo(() =>
    Array.from({ length: timelineBarCount() }, (_, index) => index + 1),
  );

  // clip drag state
  let clipDrag: {
    clipId: string;
    trackId: string;
    mode: "move" | "trim-left" | "trim-right";
    offsetPx: number;
    widthPx: number;
    startLeftPx: number;
    startRightPx: number;
    minLeftPx: number;
    kind?: ClipKind;
    drumPattern?: boolean;
    sourceTrackIndex?: number;
    sourceLaneTop?: number;
  } | null = null;
  let pendingClipDrag: DraggedClipState | null = null;
  let clipDragRaf: number | undefined;
  const [draggedClip, setDraggedClip] = createSignal<DraggedClipState | null>(null);
  const scale = () => props.horizontalZoom() / STUDIO_BAR_PX;
  const visualPx = (basePx: number) => basePx * scale();
  const basePx = (visual: number) => visual / scale();
  const beatPx = () => STUDIO_BAR_PX / Math.max(1, props.timeSignature()[0]);
  const minCycleWidthPx = () => beatPx();

  createEffect(() => {
    const scrollTop = props.verticalScrollTop();
    if (timelineEl && Math.abs(timelineEl.scrollTop - scrollTop) > 0.5) {
      timelineEl.scrollTop = scrollTop;
    }
  });

  const flushClipDrag = () => {
    clipDragRaf = undefined;
    if (pendingClipDrag) setDraggedClip(pendingClipDrag);
  };

  const queueClipDrag = (next: DraggedClipState) => {
    pendingClipDrag = next;
    if (clipDragRaf === undefined) clipDragRaf = requestAnimationFrame(flushClipDrag);
  };

  const snapClipLeftPx = (trackId: string, clipId: string, desiredLeftPx: number, widthPx: number, drumPattern?: boolean) => {
    if (drumPattern) {
      const snappedLeftPx = Math.max(0, Math.round(desiredLeftPx / BAR_PX) * BAR_PX);
      return { visualLeftPx: snappedLeftPx, snappedLeftPx };
    }

    const track = props.tracks().find((item) => item.id === trackId);
    const snappedLeftPx = snapMoveLeftPx(track?.clips ?? [], clipId, desiredLeftPx, widthPx, beatPx(), EDGE_SNAP_PX);
    return { visualLeftPx: snappedLeftPx, snappedLeftPx };
  };

  const trackAtClientPoint = (clientX: number, clientY: number, kind?: ClipKind, drumPattern?: boolean) => {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const lane = element?.closest<HTMLElement>(".bl__lane[data-track-id]");
    const trackId = lane?.dataset.trackId;
    const trackIndex = Number(lane?.dataset.trackIndex ?? NaN);
    const track = props.tracks().find((item) => item.id === trackId);
    if (!lane || !track || !Number.isFinite(trackIndex)) return null;
    if (drumPattern ? track.type !== "drum" : kind && !isTrackTypeAllowedForClipKind(track.type, kind)) return null;
    return { track, trackIndex, laneTop: lane.getBoundingClientRect().top };
  };

  const dragTransform = (clipId: string, baseLeftPx: number) => {
    const dc = draggedClip();
    if (!dc || dc.clipId !== clipId) return undefined;
    return `translate3d(${visualPx(dc.leftPx - baseLeftPx)}px, ${dc.deltaY - 2}px, 0)`;
  };

  const dragWidth = (clipId: string, baseWidthPx: number) => {
    const dc = draggedClip();
    return visualPx(dc && dc.clipId === clipId ? dc.widthPx : baseWidthPx);
  };

  // clip context menu
  const [ctxMenu, setCtxMenu] = createSignal<ClipCtxMenu | null>(null);
  const closeCtx = () => setCtxMenu(null);

  const onTimelineWheel = (e: WheelEvent) => {
    if (!timelineEl) return;
    // Keep horizontal timeline navigation available without stealing normal vertical track scrolling.
    if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      timelineEl.scrollLeft += e.deltaY;
    }
  };

  const onTimelineMouseDown = (e: MouseEvent) => {
    if (e.button !== 1 || !timelineEl) return;
    e.preventDefault();
    dragState = { x: e.clientX, scroll: timelineEl.scrollLeft };
    document.body.style.cursor = "grabbing";
  };

  const onRulerMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || !timelineEl) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = timelineEl.getBoundingClientRect();
    const x = Math.max(0, basePx(e.clientX - rect.left + timelineEl.scrollLeft));
    props.setPlayheadPx(x);
    playheadDragState = { startX: e.clientX, startPx: x };
    document.body.style.cursor = "col-resize";
  };

  const setCycleFromDrag = (startPx: number, endPx: number) => {
    const left = Math.max(0, Math.min(startPx, endPx - minCycleWidthPx()));
    const right = Math.max(left + minCycleWidthPx(), endPx);
    props.onSetCycle(
      Math.round(left / beatPx()) * beatPx(),
      Math.round(right / beatPx()) * beatPx(),
      true,
    );
  };

  const onWinMouseMove = (e: MouseEvent) => {
    if (dragState && timelineEl) timelineEl.scrollLeft = dragState.scroll - (e.clientX - dragState.x);
    if (playheadDragState) {
      props.setPlayheadPx(Math.max(0, playheadDragState.startPx + basePx(e.clientX - playheadDragState.startX)));
    }
    if (cycleDragState) {
      e.preventDefault();
      const dx = basePx(e.clientX - cycleDragState.startX);
      if (Math.abs(dx) > 3) cycleDragState.moved = true;
      if (cycleDragState.mode === "move") {
        const width = cycleDragState.endPx - cycleDragState.startPx;
        const nextStart = Math.max(0, cycleDragState.startPx + dx);
        setCycleFromDrag(nextStart, nextStart + width);
      } else if (cycleDragState.mode === "left") {
        setCycleFromDrag(cycleDragState.startPx + dx, cycleDragState.endPx);
      } else {
        setCycleFromDrag(cycleDragState.startPx, cycleDragState.endPx + dx);
      }
    }
    if (clipDrag && timelineEl) {
      e.preventDefault();
      const rect = timelineEl.getBoundingClientRect();
      const pointerPx = basePx(e.clientX - rect.left + timelineEl.scrollLeft);
      const target = clipDrag.mode === "move"
        ? trackAtClientPoint(e.clientX, e.clientY, clipDrag.kind, clipDrag.drumPattern)
        : null;
      const targetTrackId = target?.track.id ?? clipDrag.trackId;
      const targetIndex = target?.trackIndex ?? clipDrag.sourceTrackIndex ?? 0;
      const sourceIndex = clipDrag.sourceTrackIndex ?? targetIndex;
      const fallbackDeltaY = (targetIndex - sourceIndex) * props.verticalZoom();
      const deltaY = clipDrag.mode === "move" ? ((target && clipDrag.sourceLaneTop !== undefined) ? target.laneTop - clipDrag.sourceLaneTop : fallbackDeltaY) : 0;
      if (clipDrag.mode === "move") {
        const desiredLeftPx = Math.max(0, pointerPx - clipDrag.offsetPx);
        const { visualLeftPx, snappedLeftPx } = snapClipLeftPx(
          targetTrackId,
          clipDrag.clipId,
          desiredLeftPx,
          clipDrag.widthPx,
          clipDrag.drumPattern,
        );
        queueClipDrag({
          clipId: clipDrag.clipId,
          barStart: pxToBars(snappedLeftPx),
          leftPx: visualLeftPx,
          snappedLeftPx,
          widthPx: clipDrag.widthPx,
          targetPx: snappedLeftPx,
          sourceTrackId: clipDrag.trackId,
          targetTrackId,
          deltaY,
        });
      } else if (clipDrag.mode === "trim-left") {
        const track = props.tracks().find((item) => item.id === clipDrag?.trackId);
        const snappedEdgePx = snapRegionEdgePx(track?.clips ?? [], clipDrag.clipId, Math.max(0, pointerPx), beatPx(), EDGE_SNAP_PX);
        const leftPx = Math.max(clipDrag.minLeftPx, Math.min(snappedEdgePx, clipDrag.startRightPx - MIN_REGION_PX));
        queueClipDrag({
          clipId: clipDrag.clipId,
          barStart: pxToBars(leftPx),
          leftPx,
          snappedLeftPx: leftPx,
          widthPx: clipDrag.startRightPx - leftPx,
          targetPx: leftPx,
          sourceTrackId: clipDrag.trackId,
          targetTrackId: clipDrag.trackId,
          deltaY: 0,
        });
      } else {
        const track = props.tracks().find((item) => item.id === clipDrag?.trackId);
        const snappedEdgePx = snapRegionEdgePx(track?.clips ?? [], clipDrag.clipId, Math.max(0, pointerPx), beatPx(), EDGE_SNAP_PX);
        const rightPx = Math.max(clipDrag.startLeftPx + MIN_REGION_PX, snappedEdgePx);
        queueClipDrag({
          clipId: clipDrag.clipId,
          barStart: pxToBars(clipDrag.startLeftPx),
          leftPx: clipDrag.startLeftPx,
          snappedLeftPx: clipDrag.startLeftPx,
          widthPx: rightPx - clipDrag.startLeftPx,
          targetPx: rightPx,
          sourceTrackId: clipDrag.trackId,
          targetTrackId: clipDrag.trackId,
          deltaY: 0,
        });
      }
    }
  };

  const onWinMouseUp = () => {
    if (dragState) { dragState = null; document.body.style.cursor = ""; }
    if (playheadDragState) {
      void props.onSeek(props.playheadPx());
      playheadDragState = null;
      document.body.style.cursor = "";
    }
    if (cycleDragState) {
      if (cycleDragState.mode === "move" && !cycleDragState.moved) props.onToggleCycle();
      cycleDragState = null;
      document.body.style.cursor = "";
    }
    if (clipDrag) {
      if (clipDragRaf !== undefined) {
        cancelAnimationFrame(clipDragRaf);
        clipDragRaf = undefined;
      }
      if (pendingClipDrag) setDraggedClip(pendingClipDrag);
      const dc = pendingClipDrag ?? draggedClip();
      if (dc) {
        if (clipDrag.mode === "trim-left") {
          props.onTrimClip(clipDrag.trackId, clipDrag.clipId, "left", dc.targetPx);
        } else if (clipDrag.mode === "trim-right") {
          props.onTrimClip(clipDrag.trackId, clipDrag.clipId, "right", dc.targetPx);
        } else {
          props.onMoveClipToTrack(clipDrag.trackId, clipDrag.clipId, dc.targetTrackId, dc.barStart);
        }
      }
      clipDrag = null;
      pendingClipDrag = null;
      setDraggedClip(null);
      document.body.style.cursor = "";
    }
  };

  const onLaneDblClick = (e: MouseEvent, trackId: string, trackType: TrackType) => {
    if (trackType === "drum" || trackType === "voice") return;
    if ((e.target as HTMLElement).closest(".bl__mclip")) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = basePx(e.clientX - rect.left);
    props.onCreateRegion(trackId, Math.max(0, Math.floor(x / BAR_PX)));
  };

  onMount(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCtx();
    };
    window.addEventListener("mousemove", onWinMouseMove);
    window.addEventListener("mouseup", onWinMouseUp);
    window.addEventListener("click", closeCtx);
    window.addEventListener("keydown", onEscape);
    onCleanup(() => window.removeEventListener("keydown", onEscape));
  });
  onCleanup(() => {
    if (clipDragRaf !== undefined) cancelAnimationFrame(clipDragRaf);
    window.removeEventListener("mousemove", onWinMouseMove);
    window.removeEventListener("mouseup", onWinMouseUp);
    window.removeEventListener("click", closeCtx);
  });

  return (
    <section
      class="bl__timeline"
      ref={timelineEl}
      style={{ "--timeline-bars": `${timelineBarCount()}` }}
      onWheel={onTimelineWheel}
      onMouseDown={onTimelineMouseDown}
      onScroll={(event) => props.onVerticalScroll(event.currentTarget.scrollTop)}
    >
      <div class="bl__ruler" onMouseDown={onRulerMouseDown}>
        <div
          class={`bl__cycle ${props.cycleEnabled() ? "is-active" : ""}`}
          style={{
            left: `${visualPx(props.cycleStartPx())}px`,
            width: `${visualPx(Math.max(minCycleWidthPx(), props.cycleEndPx() - props.cycleStartPx()))}px`,
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            cycleDragState = { mode: "move", startX: e.clientX, startPx: props.cycleStartPx(), endPx: props.cycleEndPx(), moved: false };
            document.body.style.cursor = "grabbing";
          }}
        >
          <span
            class="bl__cycle-locator bl__cycle-locator--left"
            title="Left locator"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              props.onSetCycle(props.cycleStartPx(), props.cycleEndPx(), true);
              cycleDragState = { mode: "left", startX: e.clientX, startPx: props.cycleStartPx(), endPx: props.cycleEndPx(), moved: false };
              document.body.style.cursor = "ew-resize";
            }}
          />
          <span class="bl__cycle-fill" />
          <span
            class="bl__cycle-locator bl__cycle-locator--right"
            title="Right locator"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              props.onSetCycle(props.cycleStartPx(), props.cycleEndPx(), true);
              cycleDragState = { mode: "right", startX: e.clientX, startPx: props.cycleStartPx(), endPx: props.cycleEndPx(), moved: false };
              document.body.style.cursor = "ew-resize";
            }}
          />
        </div>
        <For each={timelineBars()}>
          {(bar) => (
            <div class="bl__bar">
              <span class="bl__bar-num">{bar}</span>
              <For each={Array.from({ length: props.timeSignature()[0] - 1 }, (_, index) => index + 1)}>
                {(beat) => (
                  <span
                    class="bl__beat-tick"
                    style={{ left: `${(beat / props.timeSignature()[0]) * 100}%` }}
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </div>

      <div
        class={`bl__lanes ${props.globalDragOver() ? "is-global-drop" : ""}`}
        onDragOver={props.onLanesDragOver}
        onDragLeave={props.onLanesDragLeave}
        onDrop={props.onLanesDrop}
      >
        <Show when={props.tracks().length === 0}>
          <div class="bl__stage-empty">
            <div class={`bl__stage-empty-card ${props.globalDragOver() ? "is-drop" : ""}`}>
              <Show when={!props.globalDragOver()} fallback={
                <>
                  <span class="bl__stage-empty-eyebrow">Release to import</span>
                  <h2 class="bl__stage-empty-title">Drop it in</h2>
                  <p class="bl__stage-empty-sub">Audio, MIDI, and video files are supported</p>
                </>
              }>
                <span class="bl__stage-empty-eyebrow">Empty session</span>
                <h2 class="bl__stage-empty-title">Your canvas awaits</h2>
                <p class="bl__stage-empty-sub">Add a track, pick a template, or drop any audio / MIDI / video file here.</p>
                <div class="bl__stage-empty-actions">
                  <button class="bl__btn-pink" onClick={props.onShowNewTrack}>+ Add a track</button>
                  <button class="bl__btn-ghost" onClick={() => props.onAddTrack("drum")}>Drum machine</button>
                </div>
                <div class="bl__stage-templates">
                  <span class="bl__stage-tmpl-label">Quick start</span>
                  <div class="bl__stage-tmpl-row">
                    <For each={TEMPLATES}>
                      {(tmpl) => (
                        <button
                          class="bl__stage-tmpl-card"
                          style={{ "--tc": tmpl.color }}
                          onClick={() => props.onApplyTemplate(tmpl.id)}
                        >
                          <span class="bl__stage-tmpl-genre">{tmpl.genre}</span>
                          <span class="bl__stage-tmpl-name">{tmpl.name}</span>
                          <span class="bl__stage-tmpl-bpm">{tmpl.bpm} BPM</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        <div class="bl__timeline-automix-spacer" aria-hidden="true" />

        <For each={props.tracks()}>
          {(t, trackIndex) => (
            <div
              class={`bl__lane ${props.selectedTrack() === t.id ? "is-sel" : ""} ${props.dropTarget()?.trackId === t.id ? "is-drop" : ""} ${draggedClip()?.targetTrackId === t.id ? "is-region-target" : ""} ${draggedClip()?.sourceTrackId === t.id ? "is-drag-origin" : ""}`}
              data-track-id={t.id}
              data-track-index={trackIndex()}
              style={{
                "--tc": t.color,
                "--beats-per-bar": `${props.timeSignature()[0]}`,
              }}
              onDragOver={(e) => props.onLaneDragOver(e, t.id)}
              onDragLeave={props.onLaneDragLeave}
              onDrop={(e) => props.onLaneDrop(e, t.id)}
              onDblClick={(e) => onLaneDblClick(e, t.id, t.type)}
            >
              <Show when={props.recordingTrackId() === t.id}>
                <Show
                  when={props.recordingMode() === "midi"}
                  fallback={
                    <LiveRecordingClip
                      startPx={visualPx(props.recordingStartPx())}
                      endPx={() => visualPx(props.recordingEndPx())}
                      color={t.color}
                    />
                  }
                >
                  <LiveMidiRecordingClip
                    startPx={visualPx(props.recordingStartPx())}
                    endPx={() => visualPx(props.recordingEndPx())}
                    takeBars={() => Math.max(0.001, (props.recordingEndPx() - props.recordingStartPx()) / BAR_PX)}
                    notes={props.liveMidiNotes}
                    color={t.color}
                  />
                </Show>
              </Show>

              <For each={(t.clips ?? []).filter((clip) => isTrackAllowedForClip(t, clip))}>
                {(c) => (
                  (() => {
                    const baseLeftPx = clipLeftPx(c);
                    const baseWidthPx = clipWidthPx(c);
                    const baseRightPx = clipRightPx(c);
                    const minLeftPx = Math.max(0, baseLeftPx - (c.sourceOffsetBars ?? 0) * BAR_PX);
                    return (
                  <div
                    class={`bl__mclip is-${c.drumPattern ? "drum" : c.kind}`}
                    classList={{
                      "is-dragging": draggedClip()?.clipId === c.id,
                      "is-selected": props.selectedClipId() === c.id,
                    }}
                    style={{
                      left: `${visualPx(baseLeftPx)}px`,
                      width: `${dragWidth(c.id, baseWidthPx)}px`,
                      "--tc": t.color,
                      transform: dragTransform(c.id, baseLeftPx),
                    }}
                    aria-label={`${c.name}, ${c.bars} bar${c.bars > 1 ? "s" : ""}`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      e.preventDefault();
                      props.onSelectClip(t.id, c.id);
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        clipDrag = { clipId: c.id, trackId: t.id, mode: "move", offsetPx: basePx(e.clientX - rect.left), widthPx: baseWidthPx, startLeftPx: baseLeftPx, startRightPx: baseRightPx, minLeftPx, kind: c.kind, drumPattern: c.drumPattern, sourceTrackIndex: trackIndex(), sourceLaneTop: (e.currentTarget as HTMLElement).closest(".bl__lane")?.getBoundingClientRect().top };
                      const leftPx = clipLeftPx(c);
                      setDraggedClip({ clipId: c.id, barStart: c.barStart, leftPx, snappedLeftPx: leftPx, widthPx: baseWidthPx, targetPx: leftPx, sourceTrackId: t.id, targetTrackId: t.id, deltaY: 0 });
                      document.body.style.cursor = "grabbing";
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtxMenu({ x: e.clientX, y: e.clientY, trackId: t.id, clipId: c.id, clipName: c.name });
                    }}
                  >
                    <span
                      class="bl__mclip-trim bl__mclip-trim--left"
                      title="Trim left edge"
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        e.stopPropagation();
                        props.onSelectClip(t.id, c.id);
                        clipDrag = { clipId: c.id, trackId: t.id, mode: "trim-left", offsetPx: 0, widthPx: baseWidthPx, startLeftPx: baseLeftPx, startRightPx: baseRightPx, minLeftPx, kind: c.kind, drumPattern: c.drumPattern, sourceTrackIndex: trackIndex(), sourceLaneTop: (e.currentTarget as HTMLElement).closest(".bl__lane")?.getBoundingClientRect().top };
                        setDraggedClip({ clipId: c.id, barStart: c.barStart, leftPx: baseLeftPx, snappedLeftPx: baseLeftPx, widthPx: baseWidthPx, targetPx: baseLeftPx, sourceTrackId: t.id, targetTrackId: t.id, deltaY: 0 });
                        document.body.style.cursor = "ew-resize";
                      }}
                    />
                    <span
                      class="bl__mclip-trim bl__mclip-trim--right"
                      title="Trim right edge"
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        e.stopPropagation();
                        props.onSelectClip(t.id, c.id);
                        clipDrag = { clipId: c.id, trackId: t.id, mode: "trim-right", offsetPx: 0, widthPx: baseWidthPx, startLeftPx: baseLeftPx, startRightPx: baseRightPx, minLeftPx, kind: c.kind, drumPattern: c.drumPattern, sourceTrackIndex: trackIndex(), sourceLaneTop: (e.currentTarget as HTMLElement).closest(".bl__lane")?.getBoundingClientRect().top };
                        setDraggedClip({ clipId: c.id, barStart: c.barStart, leftPx: baseLeftPx, snappedLeftPx: baseLeftPx, widthPx: baseWidthPx, targetPx: baseRightPx, sourceTrackId: t.id, targetTrackId: t.id, deltaY: 0 });
                        document.body.style.cursor = "ew-resize";
                      }}
                    />
                    <div class="bl__mclip-head">
                      <span class="bl__mclip-icon" aria-hidden="true"><MediaClipIcon kind={c.kind} /></span>
                      <span class="bl__mclip-name">{c.name}</span>
                      <button
                        class="bl__mclip-x"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); props.onDeleteClip(t.id, c.id); }}
                        title="Remove clip"
                      >×</button>
                    </div>
                    <div class="bl__mclip-body">
                      <Show when={c.drumPattern} fallback={
                        <Show
                          when={c.kind === "midi"}
                          fallback={
                            <Show when={c.url}>
                              <AudioWaveformDisplay url={c.url} color={t.color} />
                            </Show>
                          }
                        >
                          <MidiNotesOverview clip={c} />
                        </Show>
                      }>
                        <div class="bl__drum-region-grid" aria-hidden="true">
                          <For each={props.pattern().rows.filter(r => !r.muted && r.velocities.some(v => v > 0))}>
                            {(row) => (
                              <div class="bl__drum-region-row">
                                <For each={row.velocities}>
                                  {(v) => <span classList={{ "is-on": v > 0 }} />}
                                </For>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </div>
                    );
                  })()
                )}
              </For>

              <Show when={props.dropTarget()?.trackId === t.id}>
                <div class="bl__drop-marker" style={{ left: `${visualPx((props.dropTarget()?.bar ?? 0) * BAR_PX)}px` }} />
              </Show>
            </div>
          )}
        </For>

        <div
          class={`bl__import-drop ${props.globalDragOver() ? "is-over" : ""}`}
          role="button" tabIndex={0}
            onClick={() => importInputEl?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); importInputEl?.click(); } }}
            onDragOver={(e) => {
              if (!e.dataTransfer?.types.includes("Files")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={async (e) => {
              e.preventDefault();
              await props.onImportFiles(Array.from(e.dataTransfer?.files ?? []));
            }}
          >
            <input
              ref={(el) => (importInputEl = el)}
              type="file" accept="audio/*,video/*,.mid,.midi" multiple
              style={{ display: "none" }}
              onChange={async (e) => {
                const files = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = "";
                await props.onImportFiles(files);
              }}
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" class="bl__import-drop-icon" aria-hidden="true">
              <path d="M9 18V6l12-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              <line x1="2" y1="2" x2="2" y2="6"/><line x1="0" y1="4" x2="4" y2="4"/>
            </svg>
            <span>Drop a loop or an audio/MIDI/video file</span>
          </div>

      </div>

      <div class="bl__playhead"
        style={{ left: `${visualPx(props.playheadPx())}px` }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          playheadDragState = { startX: e.clientX, startPx: props.playheadPx() };
          document.body.style.cursor = "col-resize";
        }}
      />

      <Show when={ctxMenu()}>
        {(menu) => (
          <div
            class="bl__clip-ctx"
            style={{ left: `${Math.min(menu().x, window.innerWidth - 210)}px`, top: `${Math.min(menu().y, window.innerHeight - 280)}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <Show when={menu().renaming} fallback={
              <>
                <button class="bl__clip-ctx-item" onClick={() => { props.onDuplicateClip(menu().trackId, menu().clipId); closeCtx(); }}>
                  <span>Duplicate</span>
                  <span class="bl__clip-ctx-kbd">⌘D</span>
                </button>
                <button class="bl__clip-ctx-item" onClick={() => { props.onSplitClip(menu().trackId, menu().clipId, props.playheadPx()); closeCtx(); }}>
                  <span>Split at Playhead</span>
                  <span class="bl__clip-ctx-kbd">⌘E</span>
                </button>
                <button class="bl__clip-ctx-item" onClick={() => { props.onDeleteClip(menu().trackId, menu().clipId); closeCtx(); }}>
                  <span>Cut</span>
                  <span class="bl__clip-ctx-kbd">⌘X</span>
                </button>
                <div class="bl__clip-ctx-sep" />
                <button class="bl__clip-ctx-item" onClick={() => setCtxMenu(m => m ? { ...m, renaming: true } : null)}>
                  <span>Rename Region</span>
                </button>
                <div class="bl__clip-ctx-sep" />
                <button class="bl__clip-ctx-item is-soon" disabled>
                  <span>Export as WAV</span>
                  <span class="bl__clip-ctx-soon">Soon</span>
                </button>
                <button class="bl__clip-ctx-item is-soon" disabled>
                  <span>Reverse Region</span>
                  <span class="bl__clip-ctx-soon">Soon</span>
                </button>
                <button class="bl__clip-ctx-item is-soon" disabled>
                  <span>Normalize</span>
                  <span class="bl__clip-ctx-soon">Soon</span>
                </button>
                <div class="bl__clip-ctx-sep" />
                <button class="bl__clip-ctx-item is-danger" onClick={() => { props.onDeleteClip(menu().trackId, menu().clipId); closeCtx(); }}>
                  <span>Delete</span>
                  <span class="bl__clip-ctx-kbd">⌫</span>
                </button>
              </>
            }>
              <div class="bl__clip-ctx-renaming">
                <span class="bl__clip-ctx-rename-label">Rename Region</span>
                <input
                  class="bl__clip-ctx-input"
                  ref={(el) => { renameInputEl = el; requestAnimationFrame(() => { el.focus(); el.select(); }); }}
                  value={menu().clipName}
                  onInput={(e) => setCtxMenu(m => m ? { ...m, clipName: e.currentTarget.value } : null)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      const val = (renameInputEl?.value ?? "").trim();
                      if (val) props.onRenameClip(menu().trackId, menu().clipId, val);
                      closeCtx();
                    }
                    if (e.key === "Escape") closeCtx();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div class="bl__clip-ctx-rename-row">
                  <button class="bl__clip-ctx-rename-cancel" onMouseDown={(e) => { e.preventDefault(); closeCtx(); }}>Cancel</button>
                  <button class="bl__clip-ctx-rename-ok" onMouseDown={(e) => {
                    e.preventDefault();
                    const val = (renameInputEl?.value ?? "").trim();
                    if (val) props.onRenameClip(menu().trackId, menu().clipId, val);
                    closeCtx();
                  }}>Rename</button>
                </div>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </section>
  );
};

export default TimelineArea;
