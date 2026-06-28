import { type Component, For, Show, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { MediaClip, UITrack } from "../types";
import AudioWaveformDisplay from "./AudioWaveformDisplay";

const MAIN_BAR_PX = 240;
const ZOOM = 2;
const EDITOR_BAR_PX = MAIN_BAR_PX * ZOOM; // 160px per bar in editor view
const TOTAL_BARS = 64;

interface Props {
  clip:       Accessor<MediaClip | null>;
  track:      Accessor<UITrack | null>;
  tracks:     Accessor<UITrack[]>;
  playheadPx: Accessor<number>;
  onPatch:    (patch: Partial<MediaClip>) => void;
  onCollapse: () => void;
}

const AudioClipEditor: Component<Props> = (props) => {
  const pitch    = () => props.clip()?.pitch        ?? 0;
  const rate     = () => props.clip()?.playbackRate ?? 1;
  const gain     = () => props.clip()?.gain         ?? 0;
  const reversed = () => props.clip()?.reversed     ?? false;

  const voiceTrack = createMemo(() => props.tracks().find(t => t.type === "voice"));
  const voiceClips = createMemo(() => voiceTrack()?.clips ?? []);
  const trackColor = () => voiceTrack()?.color ?? "#e05297";

  const bars = Array.from({ length: TOTAL_BARS }, (_, i) => i + 1);

  const handleRateChange = (newRate: number) => {
    const c = props.clip();
    if (!c) return;
    const currentRate = c.playbackRate ?? 1;
    const unscaledBars = c.bars * currentRate;
    const newBars = unscaledBars / newRate;
    const patch: Partial<MediaClip> = { playbackRate: newRate, bars: newBars };
    if (c.widthPx !== undefined) patch.widthPx = newBars * MAIN_BAR_PX;
    if (c.originalBars !== undefined) patch.originalBars = c.originalBars; // keep it same, it's unscaled conceptually, or do we need to scale originalBars?
    // Wait, originalBars is used to cap right-trim expansion. If we speed it up, the maximum length we can trim out also shrinks!
    // So we SHOULD scale originalBars as well.
    if (c.originalBars !== undefined) patch.originalBars = (c.originalBars * currentRate) / newRate;
    
    props.onPatch(patch);
  };

  const handleRetune = () => {
    const c = props.clip();
    if (!c) return;
    const currentRate = c.playbackRate ?? 1;
    const restoredBars = c.bars * currentRate;
    const patch: Partial<MediaClip> = {
      pitch: 0,
      playbackRate: 1,
      bars: restoredBars,
    };
    if (c.widthPx !== undefined) patch.widthPx = restoredBars * MAIN_BAR_PX;
    if (c.originalBars !== undefined) patch.originalBars = c.originalBars * currentRate;
    props.onPatch(patch);
  };

  return (
    <div class="ace">

      {/* ── Left: controls ── */}
      <div class="ace__controls">
        <div class="ace__header">
          <button class="ace__close" onClick={props.onCollapse}>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M2 2l8 8M10 2l-8 8"/>
            </svg>
          </button>
          <span class="ace__header-icon" style={{ color: trackColor() }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
            </svg>
          </span>
          <span class="ace__header-name">{props.clip()?.name ?? "Voice/Audio"}</span>
        </div>

        <div class="ace__field">
          <span class="ace__label">Pitch Shift</span>
          <div class="ace__stepper">
            <button class="ace__step-btn" onClick={() => props.onPatch({ pitch: Math.max(-12, pitch() - 1) })}>—</button>
            <span class="ace__step-val">{pitch() > 0 ? `+${pitch()}` : String(pitch())}</span>
            <button class="ace__step-btn" onClick={() => props.onPatch({ pitch: Math.min(12, pitch() + 1) })}>+</button>
          </div>
        </div>

        <div class="ace__field">
          <span class="ace__label">Playback Rate (Speed)</span>
          <div class="ace__stepper">
            <button class="ace__step-btn" onClick={() => handleRateChange(Math.max(0.25, parseFloat((rate() - 0.05).toFixed(2))))}>—</button>
            <span class="ace__step-val">{rate().toFixed(2)}</span>
            <button class="ace__step-btn" onClick={() => handleRateChange(Math.min(4, parseFloat((rate() + 0.05).toFixed(2))))}>+</button>
          </div>
        </div>

        <div class="ace__field">
          <div class="ace__label-row">
            <span class="ace__label">Region Gain</span>
            <span class="ace__label-val">{gain() >= 0 ? `+${gain().toFixed(1)}` : gain().toFixed(1)} dB</span>
          </div>
          <input class="ace__slider" type="range" min="-24" max="12" step="0.5"
            value={gain()}
            onInput={(e) => props.onPatch({ gain: parseFloat(e.currentTarget.value) })}
          />
        </div>

        <div class="ace__actions">
          <button class={`ace__btn${reversed() ? " is-on" : ""}`}
            onClick={() => props.onPatch({ reversed: !reversed() })}>
            Reverse
          </button>
          <div class="ace__btn-row">
            <button
              class="ace__btn ace__btn--retune"
              onClick={handleRetune}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M2 9c1.5 0 1.5-2.5 3-2.5S7.5 11 9 11s1.5-2.5 3-2.5S13.5 9 15 9"/>
              </svg>
              Retune
            </button>
            <button class="ace__info-btn" title="Info">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <circle cx="8" cy="8" r="6.5"/>
                <path d="M8 7.5v3.5M8 5.5v.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: timeline waveform view ── */}
      <div class="ace__timeline">
        {/* Ruler */}
        <div class="ace__ruler">
          <For each={bars}>{(bar) =>
            <div class="ace__ruler-bar">
              <span class="ace__ruler-num">{bar}</span>
            </div>
          }</For>
        </div>

        {/* Clips lane */}
        <div class="ace__lane">
          <For each={voiceClips()}>{(clip) => {
            const leftPx = () => (clip.leftPx != null ? clip.leftPx * ZOOM : clip.barStart * EDITOR_BAR_PX);
            const widthPx = () => (clip.widthPx != null ? clip.widthPx * ZOOM : clip.bars * EDITOR_BAR_PX);
            const url = () => clip.dataUrl ?? clip.url ?? clip.remoteUrl;
            return (
              <div
                class="ace__clip"
                style={{
                  left: `${leftPx()}px`,
                  width: `${widthPx()}px`,
                  "--tc": trackColor(),
                }}
              >
                <span class="ace__clip-name">{clip.name}</span>
                <Show when={url()}>
                  <div class="ace__clip-wave">
                    <AudioWaveformDisplay url={url()!} color={trackColor()} />
                  </div>
                </Show>
              </div>
            );
          }}</For>

          {/* Playhead */}
          <div class="ace__playhead" style={{ left: `${props.playheadPx() * ZOOM}px` }} />
        </div>
      </div>

    </div>
  );
};

export default AudioClipEditor;
