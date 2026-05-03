import { type Component, For, Show, onMount, onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { MicVocal, FileMusic } from "lucide-solid";
import { type TrackType, type UITrack } from "../types";
import type { StepPattern } from "~/lib/audio/stepSeq";
import AudioWaveformDisplay from "./AudioWaveformDisplay";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MEDIA_ICON_MAP: Record<string, Component<any>> = { audio: MicVocal, midi: FileMusic, video: MicVocal };
const MediaClipIcon: Component<{ kind: string }> = (props) => {
  const Icon = MEDIA_ICON_MAP[props.kind];
  return Icon ? <Icon size={11} stroke-width={1.6} aria-hidden="true" /> : null;
};

type Props = {
  tracks: Accessor<UITrack[]>;
  selectedTrack: Accessor<string | null>;
  pattern: Accessor<StepPattern>;
  playheadPx: Accessor<number>;
  setPlayheadPx: Setter<number>;
  drumClipBars: Accessor<number[]>;
  dropTarget: Accessor<{ trackId: string; bar: number } | null>;
  globalDragOver: Accessor<boolean>;
  onLaneDragOver: (e: DragEvent, trackId: string) => void;
  onLaneDragLeave: (e: DragEvent) => void;
  onLaneDrop: (e: DragEvent, trackId: string) => Promise<void>;
  onLanesDragOver: (e: DragEvent) => void;
  onLanesDragLeave: (e: DragEvent) => void;
  onLanesDrop: (e: DragEvent) => Promise<void>;
  onDeleteClip: (trackId: string, clipId: string) => void;
  onImportFiles: (files: File[]) => Promise<void>;
  onAddTrack: (type: TrackType, openModal?: boolean) => void;
  onShowNewTrack: () => void;
};

const BARS = Array.from({ length: 450 }, (_, i) => i + 1);

const TimelineArea: Component<Props> = (props) => {
  let timelineEl: HTMLDivElement | undefined;
  let dragState: { x: number; scroll: number } | null = null;
  let playheadDragState: { startX: number; startPx: number } | null = null;
  let importInputEl: HTMLInputElement | undefined;

  const onTimelineWheel = (e: WheelEvent) => {
    if (!timelineEl) return;
    if (e.shiftKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
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
    const x = Math.max(0, e.clientX - rect.left + timelineEl.scrollLeft);
    props.setPlayheadPx(x);
    playheadDragState = { startX: e.clientX, startPx: x };
    document.body.style.cursor = "col-resize";
  };

  const onWinMouseMove = (e: MouseEvent) => {
    if (dragState && timelineEl) timelineEl.scrollLeft = dragState.scroll - (e.clientX - dragState.x);
    if (playheadDragState) props.setPlayheadPx(Math.max(0, playheadDragState.startPx + (e.clientX - playheadDragState.startX)));
  };

  const onWinMouseUp = () => {
    if (dragState) { dragState = null; document.body.style.cursor = ""; }
    if (playheadDragState) { playheadDragState = null; document.body.style.cursor = ""; }
  };

  onMount(() => {
    window.addEventListener("mousemove", onWinMouseMove);
    window.addEventListener("mouseup", onWinMouseUp);
  });
  onCleanup(() => {
    window.removeEventListener("mousemove", onWinMouseMove);
    window.removeEventListener("mouseup", onWinMouseUp);
  });

  return (
    <section
      class="bl__timeline"
      ref={timelineEl}
      onWheel={onTimelineWheel}
      onMouseDown={onTimelineMouseDown}
    >
      <div class="bl__ruler" onMouseDown={onRulerMouseDown}>
        <For each={BARS}>{(b) => <div class="bl__bar"><span class="bl__bar-num">{b}</span></div>}</For>
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
                <p class="bl__stage-empty-sub">Add a track from the left, or drag any audio / MIDI / video file here.</p>
                <div class="bl__stage-empty-actions">
                  <button class="bl__btn-pink" onClick={props.onShowNewTrack}>+ Add a track</button>
                  <button class="bl__btn-ghost" onClick={() => props.onAddTrack("drum")}>Drum machine</button>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        <For each={props.tracks()}>
          {(t) => (
            <div
              class={`bl__lane ${props.selectedTrack() === t.id ? "is-sel" : ""} ${props.dropTarget()?.trackId === t.id ? "is-drop" : ""}`}
              style={{ "--tc": t.color }}
              onDragOver={(e) => props.onLaneDragOver(e, t.id)}
              onDragLeave={props.onLaneDragLeave}
              onDrop={(e) => props.onLaneDrop(e, t.id)}
            >
              <Show when={t.type === "drum"}>
                <For each={props.drumClipBars()}>
                  {(barIdx) => (
                    <div class="bl__clip" style={{ left: `${barIdx * 80}px`, width: "78px", "--tc": t.color }}>
                      <div class="bl__clip-header">
                        <span class="bl__clip-dot-led" /><span class="bl__clip-name">DRUMS</span>
                      </div>
                      <div class="bl__clip-matrix">
                        <For each={props.pattern().rows.slice(0, 8)}>
                          {(row) => (
                            <div class="bl__clip-mrow">
                              <For each={row.velocities.slice(0, 16)}>
                                {(v, i) => (
                                  <span class="bl__clip-cell" classList={{ "is-hit": v > 0, "is-beat": i() % 4 === 0, "is-soft": v > 0 && v < 0.55 }} />
                                )}
                              </For>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </Show>

              <Show when={(t.type === "instrument" || t.type === "bass" || t.type === "guitar" || t.type === "voice") && (t.clips ?? []).length === 0}>
                <div class="bl__inst-ghost" style={{ "--tc": t.color }}>
                  <span class="bl__inst-ghost-dot" />
                  <span class="bl__inst-ghost-name">
                    {t.type === "bass" ? "BASS" : t.type === "guitar" ? "GUITAR" : t.type === "voice" ? "VOICE" : "LEAD"}
                  </span>
                  <span class="bl__inst-ghost-hint">play keys to record</span>
                </div>
              </Show>

              <For each={t.clips ?? []}>
                {(c) => (
                  <div
                    class={`bl__mclip is-${c.kind}`}
                    style={{ left: `${c.barStart * 80}px`, width: `${c.bars * 80 - 2}px`, "--tc": t.color }}
                    title={`${c.name} · ${c.bars} bar${c.bars > 1 ? "s" : ""}`}
                  >
                    <div class="bl__mclip-head">
                      <span class="bl__mclip-icon" aria-hidden="true"><MediaClipIcon kind={c.kind} /></span>
                      <span class="bl__mclip-name">{c.name}</span>
                      <button class="bl__mclip-x" onClick={(e) => { e.stopPropagation(); props.onDeleteClip(t.id, c.id); }} title="Remove clip">×</button>
                    </div>
                    <div class="bl__mclip-body">
                      <Show when={c.kind !== "midi" && c.url}>
                        <AudioWaveformDisplay url={c.url} color={t.color} />
                      </Show>
                    </div>
                  </div>
                )}
              </For>

              <Show when={props.dropTarget()?.trackId === t.id}>
                <div class="bl__drop-marker" style={{ left: `${(props.dropTarget()?.bar ?? 0) * 80}px` }} />
              </Show>
            </div>
          )}
        </For>

        <Show when={props.tracks().length > 0}>
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
        </Show>
      </div>

      <div
        class="bl__playhead"
        style={{ left: `${props.playheadPx()}px` }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          playheadDragState = { startX: e.clientX, startPx: props.playheadPx() };
          document.body.style.cursor = "col-resize";
        }}
      />
    </section>
  );
};

export default TimelineArea;
