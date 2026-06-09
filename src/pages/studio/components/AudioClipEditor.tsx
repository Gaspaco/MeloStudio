import { type Component } from "solid-js";
import type { Accessor } from "solid-js";
import type { MediaClip, UITrack } from "../types";

interface Props {
  clip: Accessor<MediaClip | null>;
  track: Accessor<UITrack | null>;
  onPatch: (patch: Partial<MediaClip>) => void;
  onCollapse: () => void;
}

const AudioClipEditor: Component<Props> = (props) => {
  const pitch = () => props.clip()?.pitch ?? 0;
  const rate = () => props.clip()?.playbackRate ?? 1;
  const gain = () => props.clip()?.gain ?? 0;
  const reversed = () => props.clip()?.reversed ?? false;

  return (
    <aside class="bl__ace">
      <div class="bl__ace-head">
        <span class="bl__ace-head-icon" style={{ color: props.track()?.color ?? "#f53e3e" }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
          </svg>
        </span>
        <span class="bl__ace-head-name">{props.clip()?.name ?? "Voice/Audio"}</span>
        <button class="bl__ace-head-close" onClick={props.onCollapse}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>

      <div class="bl__ace-body">

        <div class="bl__ace-field">
          <span class="bl__ace-field-label">Pitch Shift</span>
          <div class="bl__ace-stepper">
            <button onClick={() => props.onPatch({ pitch: Math.max(-12, pitch() - 1) })}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h10"/></svg>
            </button>
            <span>{pitch() > 0 ? `+${pitch()}` : `${pitch()}`}</span>
            <button onClick={() => props.onPatch({ pitch: Math.min(12, pitch() + 1) })}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
            </button>
          </div>
        </div>

        <div class="bl__ace-field">
          <span class="bl__ace-field-label">Playback Rate (Speed)</span>
          <div class="bl__ace-stepper">
            <button onClick={() => props.onPatch({ playbackRate: Math.max(0.25, parseFloat((rate() - 0.05).toFixed(2))) })}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h10"/></svg>
            </button>
            <span>{rate().toFixed(2)}</span>
            <button onClick={() => props.onPatch({ playbackRate: Math.min(4, parseFloat((rate() + 0.05).toFixed(2))) })}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
            </button>
          </div>
        </div>

        <div class="bl__ace-field bl__ace-field--gain">
          <div class="bl__ace-field-row">
            <span class="bl__ace-field-label">Region Gain</span>
            <span class="bl__ace-gain-val">{gain() >= 0 ? `+${gain().toFixed(1)}` : gain().toFixed(1)} dB</span>
          </div>
          <input
            class="bl__ace-gain-slider"
            type="range" min="-24" max="12" step="0.5"
            value={gain()}
            onInput={(e) => props.onPatch({ gain: parseFloat(e.currentTarget.value) })}
          />
        </div>

        <div class="bl__ace-actions">
          <button
            class={`bl__ace-action-btn${reversed() ? " is-on" : ""}`}
            onClick={() => props.onPatch({ reversed: !reversed() })}
          >
            Reverse
          </button>
          <button class="bl__ace-action-btn bl__ace-action-btn--retune">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2 0 2-3 4-3s2 6 4 6 2-3 4-3"/></svg>
            Retune
          </button>
        </div>

      </div>
    </aside>
  );
};

export default AudioClipEditor;
