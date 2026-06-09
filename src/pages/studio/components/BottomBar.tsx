import { type Component, For, Show } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { UITrack } from "../types";

type Props = {
  tracks: Accessor<UITrack[]>;
  selectedTrack: Accessor<string | null>;
  activePanel: Accessor<"drum" | "keys" | "voice" | null>;
  onSetActivePanel: Setter<"drum" | "keys" | "voice" | null>;
  onLyricsToggle: () => void;
  onSelectTrack: Setter<string | null>;
};

const BottomBar: Component<Props> = (props) => (
  <div class="bl__util">
    <div class="bl__util-l">
      <Show when={props.tracks().some(t => t.type === "drum")}>
        <button
          class={`bl__util-tab ${props.activePanel() === "drum" ? "is-active" : ""}`}
          onClick={() => props.onSetActivePanel(props.activePanel() === "drum" ? null : "drum")}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="8" rx="1.5"/><path d="M4 4v8M7 4v8M10 4v8"/></svg>
          <span>Drum Machine</span>
        </button>
        <Show when={props.tracks().some(t => t.type === "instrument" || t.type === "bass" || t.type === "guitar")}>
          <span class="bl__util-sep">·</span>
        </Show>
      </Show>

      <Show when={props.tracks().some(t => t.type === "instrument" || t.type === "bass" || t.type === "guitar")}>
        <button
          class={`bl__util-tab ${props.activePanel() === "keys" ? "is-active" : ""}`}
          onClick={() => {
            if (props.activePanel() === "keys") { props.onSetActivePanel(null); return; }
            const cur = props.tracks().find(t => t.id === props.selectedTrack());
            if (!cur || (cur.type !== "instrument" && cur.type !== "bass" && cur.type !== "guitar")) {
              const instrTrack = props.tracks().find(t => t.type === "instrument" || t.type === "bass" || t.type === "guitar");
              if (instrTrack) props.onSelectTrack(instrTrack.id);
            }
            props.onSetActivePanel("keys");
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="8" rx="1"/><path d="M4 4v5M7 4v5M10 4v5M13 4v5"/><path d="M5.5 9v3M8.5 9v3M11.5 9v3"/></svg>
          <span>
            {(() => {
              const t = props.tracks().find(tr => tr.id === props.selectedTrack());
              if (t?.type === "bass") return "Bass";
              if (t?.type === "guitar") return "Guitar";
              return "Instrument";
            })()}
          </span>
        </button>
      </Show>

      <Show when={props.tracks().some(t => t.type === "voice")}>
        <span class="bl__util-sep">·</span>
        <button
          class={`bl__util-tab ${props.activePanel() === "voice" ? "is-active" : ""}`}
          onClick={() => props.onSetActivePanel(props.activePanel() === "voice" ? null : "voice")}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2z"/><path d="M4 8v.5a4 4 0 0 0 8 0V8M8 13v2M6 15h4"/></svg>
          <span>Voice</span>
        </button>
      </Show>

      <span class="bl__util-sep">·</span>
      <button class={`bl__util-btn${props.activePanel() === "keys" ? " is-ctx" : ""}`} disabled={props.activePanel() !== "keys"} title="AutoPitch™ — tune your melodies automatically">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2 0 2-3 4-3s2 6 4 6 2-3 4-3"/></svg>
        <span>AutoPitch™</span>
      </button>
      <span class="bl__util-sep">·</span>
      <button class="bl__util-btn bl__util-btn--soon" style={{ cursor: "default" }}>
        <span class="bl__util-fx">Fx</span>
        <span>Effects</span>
      </button>
      <span class="bl__util-sep">·</span>
      <button class={`bl__util-btn${props.activePanel() !== null ? " is-ctx" : ""}`} disabled={props.activePanel() === null} title="Piano roll / step editor">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3z"/><path d="M9 4l3 3"/></svg>
        <span>Editor</span>
      </button>
    </div>

    <div class="bl__util-r">
      <button class="bl__util-btn" onClick={props.onLyricsToggle} title="Write lyrics and session notes">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M3 7h10M3 10h6"/><path d="M12 10l2 2-2 2"/></svg>
        <span>Lyrics / Notes</span>
      </button>
      <span class="bl__util-sep">·</span>
      <button class="bl__util-btn bl__util-btn--melo" style={{ cursor: "default" }}>
        <span class="bl__util-melo-word">Melo</span>
        <span class="bl__util-melo-sounds">Sounds</span>
      </button>
      <span class="bl__util-sep">·</span>
      <button class="bl__util-btn" style={{ cursor: "default" }}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="12" height="6" rx="1"/><path d="M5 8h.01M8 8h.01M11 8h.01"/></svg>
        <span>Shortcuts</span>
      </button>
    </div>
  </div>
);

export default BottomBar;
