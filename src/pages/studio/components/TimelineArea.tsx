import { type Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { MicVocal, FileMusic } from "lucide-solid";
import { type TrackType, type UITrack, TEMPLATES } from "../types";
import type { StepPattern } from "~/lib/audio/stepSeq";
import AudioWaveformDisplay from "./AudioWaveformDisplay";

type ClipCtxMenu = { x: number; y: number; trackId: string; clipId: string; clipName: string; renaming?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MEDIA_ICON_MAP: Record<string, Component<any>> = { audio: MicVocal, midi: FileMusic, video: MicVocal };
const MediaClipIcon: Component<{ kind: string }> = (props) => {
  const Icon = MEDIA_ICON_MAP[props.kind];
  return Icon ? <Icon size={11} stroke-width={1.6} aria-hidden="true" /> : null;
};

const BAR_PX = 80;

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
  onMoveClip: (trackId: string, clipId: string, newBarStart: number) => void;
  onRenameClip: (trackId: string, clipId: string, name: string) => void;
  onDuplicateClip: (trackId: string, clipId: string) => void;
  onCreateRegion: (trackId: string, barStart: number) => void;
  onApplyTemplate: (templateId: string) => void;
  onImportFiles: (files: File[]) => Promise<void>;
  onAddTrack: (type: TrackType, openModal?: boolean) => void;
  onShowNewTrack: () => void;
};

const BARS = Array.from({ length: 450 }, (_, i) => i + 1);

const TimelineArea: Component<Props> = (props) => {
  let timelineEl: HTMLDivElement | undefined;
  let dragState: { x: number; scroll: number } | null = null;
  let renameInputEl: HTMLInputElement | undefined;
  let playheadDragState: { startX: number; startPx: number } | null = null;
  let importInputEl: HTMLInputElement | undefined;

  // clip drag state
  let clipDrag: { clipId: string; trackId: string; offsetPx: number } | null = null;
  const [draggedClip, setDraggedClip] = createSignal<{ clipId: string; barStart: number } | null>(null);

  // clip context menu
  const [ctxMenu, setCtxMenu] = createSignal<ClipCtxMenu | null>(null);
  const closeCtx = () => setCtxMenu(null);

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
    if (clipDrag && timelineEl) {
      const rect = timelineEl.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineEl.scrollLeft - clipDrag.offsetPx;
      setDraggedClip({ clipId: clipDrag.clipId, barStart: Math.max(0, Math.round(x / BAR_PX)) });
    }
  };

  const onWinMouseUp = () => {
    if (dragState) { dragState = null; document.body.style.cursor = ""; }
    if (playheadDragState) { playheadDragState = null; document.body.style.cursor = ""; }
    if (clipDrag) {
      const dc = draggedClip();
      if (dc) props.onMoveClip(clipDrag.trackId, clipDrag.clipId, dc.barStart);
      clipDrag = null;
      setDraggedClip(null);
      document.body.style.cursor = "";
    }
  };

  const onLaneDblClick = (e: MouseEvent, trackId: string, trackType: TrackType) => {
    if (trackType === "drum" || trackType === "voice") return;
    if ((e.target as HTMLElement).closest(".bl__mclip")) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + (timelineEl?.scrollLeft ?? 0);
    props.onCreateRegion(trackId, Math.max(0, Math.floor(x / BAR_PX)));
  };

  onMount(() => {
    window.addEventListener("mousemove", onWinMouseMove);
    window.addEventListener("mouseup", onWinMouseUp);
    window.addEventListener("click", closeCtx);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCtx(); });
  });
  onCleanup(() => {
    window.removeEventListener("mousemove", onWinMouseMove);
    window.removeEventListener("mouseup", onWinMouseUp);
    window.removeEventListener("click", closeCtx);
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

        <For each={props.tracks()}>
          {(t) => (
            <div
              class={`bl__lane ${props.selectedTrack() === t.id ? "is-sel" : ""} ${props.dropTarget()?.trackId === t.id ? "is-drop" : ""}`}
              style={{ "--tc": t.color }}
              onDragOver={(e) => props.onLaneDragOver(e, t.id)}
              onDragLeave={props.onLaneDragLeave}
              onDrop={(e) => props.onLaneDrop(e, t.id)}
              onDblClick={(e) => onLaneDblClick(e, t.id, t.type)}
            >
              <Show when={t.type === "drum"}>
                <For each={props.drumClipBars()}>
                  {(barIdx) => (
                    <div class="bl__clip" style={{ left: `${barIdx * BAR_PX}px`, width: `${BAR_PX - 2}px`, "--tc": t.color }}>
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

                </div>
              </Show>

              <For each={t.clips ?? []}>
                {(c) => (
                  <div
                    class={`bl__mclip is-${c.kind}`}
                    classList={{ "is-dragging": draggedClip()?.clipId === c.id }}
                    style={{
                      left: `${(draggedClip()?.clipId === c.id ? draggedClip()!.barStart : c.barStart) * BAR_PX}px`,
                      width: `${c.bars * BAR_PX - 2}px`,
                      "--tc": t.color,
                    }}
                    title={`${c.name} · ${c.bars} bar${c.bars > 1 ? "s" : ""}`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      clipDrag = { clipId: c.id, trackId: t.id, offsetPx: e.clientX - rect.left };
                      setDraggedClip({ clipId: c.id, barStart: c.barStart });
                      document.body.style.cursor = "grabbing";
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtxMenu({ x: e.clientX, y: e.clientY, trackId: t.id, clipId: c.id, clipName: c.name });
                    }}
                  >
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
                      <Show when={c.kind !== "midi" && c.url}>
                        <AudioWaveformDisplay url={c.url} color={t.color} />
                      </Show>
                    </div>
                  </div>
                )}
              </For>

              <Show when={props.dropTarget()?.trackId === t.id}>
                <div class="bl__drop-marker" style={{ left: `${(props.dropTarget()?.bar ?? 0) * BAR_PX}px` }} />
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
