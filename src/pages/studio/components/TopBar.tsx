import { type Component, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { fmtTime } from "../types";

type Props = {
  name: Accessor<string>;
  titleEditing: Accessor<boolean>;
  saveState: Accessor<"idle" | "saving" | "saved">;
  bpm: Accessor<number>;
  playing: Accessor<boolean>;
  elapsed: Accessor<number>;
  masterVol: Accessor<number>;
  titleInputRef: (el: HTMLInputElement) => void;
  onNavToggle: () => void;
  onDashboard: () => void;
  onStartEditTitle: () => void;
  onCommitTitle: () => Promise<void>;
  onCancelTitle: () => void;
  onSave: () => void;
  onTogglePlay: () => void;
  onStopAll: () => void;
  onUpdateBpm: (v: number) => void;
  onSetMasterVol: (v: number) => void;
  onElapsedReset: () => void;
  enhance: Accessor<boolean>;
  onToggleEnhance: () => void;
};

const TopBar: Component<Props> = (props) => (
  <header class="bl__top">
    {/* ROW 1 — title strip */}
    <div class="bl__strip">
      <div class="bl__strip-l">
        <button class="bl__icon-btn" onClick={props.onNavToggle} title="Menu">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h12M2 10h12"/></svg>
        </button>
        <button class="bl__brand" onClick={props.onDashboard}>
          <span class="bl__brand-melo">Melo</span>
          <span class="bl__brand-studio">Studio</span>
        </button>
      </div>

      <div class="bl__strip-c">
        <span class="bl__title-eyebrow">Project</span>
        <Show
          when={props.titleEditing()}
          fallback={
            <button class="bl__title bl__title--btn" onClick={props.onStartEditTitle} title="Click to rename">
              <span class="bl__title-text">{props.name()}</span>
              <svg class="bl__title-pencil" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" /><path d="M10 4l2 2" />
              </svg>
            </button>
          }
        >
          <input
            ref={props.titleInputRef}
            class="bl__title bl__title--edit"
            value={props.name()}
            onBlur={props.onCommitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void props.onCommitTitle(); }
              else if (e.key === "Escape") { e.preventDefault(); props.onCancelTitle(); }
            }}
          />
        </Show>
      </div>

      <div class="bl__strip-r">
        <div class="bl__save-status">
          <span class="bl__save-label">Last Saved</span>
          <span class="bl__save-sub">{props.saveState() === "saved" ? "Just now" : "Never"}</span>
        </div>
        <button class="bl__btn-ghost" onClick={props.onSave} disabled={props.saveState() === "saving"}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M5 3v3h5"/><circle cx="8" cy="10" r="1.5"/></svg>
          <span>{props.saveState() === "saving" ? "Saving" : props.saveState() === "saved" ? "Saved" : "Save"}</span>
        </button>
        <button class="bl__btn-pink-out" disabled>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V3"/><path d="M5 6l3-3 3 3"/><path d="M3 13h10"/></svg>
          <span>Publish</span>
        </button>
        <button class="bl__btn-ghost bl__btn-invite" disabled>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="2.5"/><path d="M3 13a5 5 0 0 1 10 0"/></svg>
          <span>Invite</span>
        </button>
        <button class="bl__icon-btn bl__bell" title="Notifications">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></svg>
          <span class="bl__bell-dot" />
        </button>
      </div>
    </div>

    {/* ROW 2 — console */}
    <div class="bl__console">
      <div class="bl__console-l">
        <div class="bl__tools">
          <button class="bl__icon-btn" title="Undo">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7a3 3 0 0 1 0 6H6"/><path d="M5.5 4.5L3 7l2.5 2.5"/></svg>
          </button>
          <button class="bl__icon-btn" title="Redo">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7H6a3 3 0 0 0 0 6h4"/><path d="M10.5 4.5L13 7l-2.5 2.5"/></svg>
          </button>
          <button class="bl__icon-btn" title="Metronome">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l-2 10h10L11 3z"/><path d="M8 6v5"/></svg>
          </button>
        </div>

        <div class="bl__session" role="group" aria-label="Session settings">
          <div class="bl__session-cell bl__session-cell--num">
            <span class="bl__session-key">
              <span class="bl__session-num">01</span>
              <span class="bl__session-key-text">Tempo</span>
            </span>
            <span class="bl__session-value">
              <input
                class="bl__session-input"
                type="number" min="40" max="240"
                value={props.bpm()}
                onInput={(e) => props.onUpdateBpm(parseInt(e.currentTarget.value, 10))}
              />
              <span class="bl__session-unit">bpm</span>
            </span>
          </div>
          <div class="bl__session-cell">
            <span class="bl__session-key">
              <span class="bl__session-num">02</span>
              <span class="bl__session-key-text">Meter</span>
            </span>
            <span class="bl__session-value">4<span class="bl__session-slash">⁄</span>4</span>
          </div>
          <button class="bl__session-cell bl__session-cell--btn" type="button">
            <span class="bl__session-key">
              <span class="bl__session-num">03</span>
              <span class="bl__session-key-text">Key</span>
            </span>
            <span class="bl__session-value bl__session-value--script">
              Auto
              <svg class="bl__session-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5l3 3 3-3"/></svg>
            </span>
          </button>
        </div>
      </div>

      <div class="bl__console-c">
        <button class="bl__t-btn" onClick={props.onElapsedReset} title="Skip to start">
          <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3.5" width="1.5" height="9" rx="0.5"/><path d="M13 3.5v9L5.5 8z"/></svg>
        </button>
        <button class={`bl__t-play ${props.playing() ? "is-on" : ""}`} onClick={props.onTogglePlay} title={props.playing() ? "Pause" : "Play"}>
          {props.playing()
            ? <svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.5"/><rect x="9" y="3" width="3" height="10" rx="0.5"/></svg>
            : <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5v9l8-4.5z"/></svg>}
        </button>
        <button class="bl__t-btn bl__t-rec" title="Record" onClick={props.onStopAll}>
          <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4"/></svg>
        </button>
        <button class="bl__t-btn" title="Loop">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6V5a2 2 0 0 1 2-2h6"/><path d="M9 1l2 2-2 2"/><path d="M13 10v1a2 2 0 0 1-2 2H5"/><path d="M7 15l-2-2 2-2"/></svg>
        </button>
        <div class="bl__timecode">{fmtTime(props.elapsed())}</div>
      </div>

      <div class="bl__console-r">
        <button
          class={`bl__mastering${props.enhance() ? " is-enhanced" : ""}`}
          type="button"
          title={props.enhance() ? "Audio Enhance: ON — click to disable" : "Audio Enhance: OFF — click to enable"}
          onClick={props.onToggleEnhance}
        >
          <span class="bl__mastering-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="5.2" /><path d="M8 3v2M8 11v2M3 8h2M11 8h2M4.6 4.6l1.4 1.4M10 10l1.4 1.4M11.4 4.6L10 6M6 10l-1.4 1.4" />
            </svg>
          </span>
          <span class="bl__mastering-name">{props.enhance() ? "Enhanced" : "Studio"}</span>
          <span class={`bl__enhance-led${props.enhance() ? " is-on" : ""}`} />
        </button>
        <span class="bl__field-sep" />
        <div class="bl__master-vol" title="Master volume" style={{ "--vol": `${Math.round(props.masterVol() * 100)}%` }}>
          <span class="bl__master-vol-head">
            <span class="bl__master-vol-label">Master</span>
            <span class="bl__db">{props.masterVol() <= 0.001 ? "-∞" : (20 * Math.log10(props.masterVol())).toFixed(1)}<span class="bl__db-unit"> dB</span></span>
          </span>
          <div class="bl__master-vol-row">
            <button class="bl__master-vol-icon" type="button"
              onClick={() => props.onSetMasterVol(props.masterVol() > 0.001 ? 0 : 0.8)}
              title={props.masterVol() <= 0.001 ? "Unmute" : "Mute"}>
              <Show when={props.masterVol() > 0.001} fallback={
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 4L4 6.5H2v3h2L7 12V4z" fill="currentColor"/>
                  <path d="M10.5 6l4 4M14.5 6l-4 4"/>
                </svg>
              }>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 4L4 6.5H2v3h2L7 12V4z" fill="currentColor"/>
                  <Show when={props.masterVol() > 0.05}><path d="M10.5 6a3 3 0 0 1 0 4"/></Show>
                  <Show when={props.masterVol() > 0.5}><path d="M12.5 4a6 6 0 0 1 0 8"/></Show>
                </svg>
              </Show>
            </button>
            <input class="bl__master-vol-range" type="range" min="0" max="1" step="0.01"
              value={props.masterVol()}
              onInput={(e) => props.onSetMasterVol(parseFloat(e.currentTarget.value))}
            />
          </div>
        </div>
      </div>
    </div>
  </header>
);

export default TopBar;
