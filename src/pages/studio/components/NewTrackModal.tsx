import { type Component, For, Show } from "solid-js";
import { KeyboardMusic, Drum, AudioWaveform, MicVocal, Disc2, Guitar } from "lucide-solid";
import type { TrackType } from "../types";
import { TRACK_DEFS } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRACK_ICON_MAP: Record<string, any> = {
  instrument: KeyboardMusic,
  drum:       Drum,
  bass:       AudioWaveform,
  voice:      MicVocal,
  sampler:    Disc2,
  guitar:     Guitar,
};

const TrackIcon: Component<{ name: string }> = (props) => {
  const Icon = TRACK_ICON_MAP[props.name];
  return Icon ? <Icon size={18} stroke-width={1.4} aria-hidden="true" /> : null;
};

interface NewTrackModalProps {
  onAddTrack: (type: TrackType) => void;
  onClose:    () => void;
}

const NewTrackModal: Component<NewTrackModalProps> = (props) => {
  return (
    <div class="bl__overlay" onClick={props.onClose}>
      <div class="bl__modal" onClick={(e) => e.stopPropagation()}>
        <button class="bl__modal-close" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>

        <div class="bl__modal-hero">
          <span class="bl__modal-eyebrow">— New Source / 06 options</span>
          <h2>What are you adding<br/>to the session?</h2>
          <p>Pick a sound source. Instruments are playable from your keyboard, audio sources record from your mic or input.</p>
        </div>

        <div class="bl__modal-section">
          <div class="bl__modal-section-head">
            <span class="bl__modal-section-num">I.</span>
            <span class="bl__modal-section-title">Instruments</span>
            <span class="bl__modal-section-rule" />
            <span class="bl__modal-section-meta">MIDI · playable</span>
          </div>
          <div class="bl__modal-rows">
            <For each={TRACK_DEFS.filter(d => d.tag === "MIDI" || d.tag === "RHYTHM")}>
              {(def) => (
                <button
                  class={`bl__nt ${def.ready ? "" : "is-locked"}`}
                  onClick={() => def.ready && props.onAddTrack(def.type)}
                  disabled={!def.ready}
                >
                  <span class="bl__nt-icon" aria-hidden="true"><TrackIcon name={def.icon} /></span>
                  <span class="bl__nt-text">
                    <span class="bl__nt-title">
                      {def.label}
                      <Show when={!def.ready}><span class="bl__nt-soon">Soon</span></Show>
                    </span>
                    <span class="bl__nt-sub">{def.sub}</span>
                  </span>
                  <span class="bl__nt-arrow" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4"/>
                    </svg>
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="bl__modal-section">
          <div class="bl__modal-section-head">
            <span class="bl__modal-section-num">II.</span>
            <span class="bl__modal-section-title">Recording</span>
            <span class="bl__modal-section-rule" />
            <span class="bl__modal-section-meta">Audio · live input</span>
          </div>
          <div class="bl__modal-rows">
            <For each={TRACK_DEFS.filter(d => d.tag === "AUDIO")}>
              {(def) => (
                <button
                  class={`bl__nt ${def.ready ? "" : "is-locked"}`}
                  onClick={() => def.ready && props.onAddTrack(def.type)}
                  disabled={!def.ready}
                >
                  <span class="bl__nt-icon" aria-hidden="true"><TrackIcon name={def.icon} /></span>
                  <span class="bl__nt-text">
                    <span class="bl__nt-title">
                      {def.label}
                      <Show when={!def.ready}><span class="bl__nt-soon">Soon</span></Show>
                    </span>
                    <span class="bl__nt-sub">{def.sub}</span>
                  </span>
                  <span class="bl__nt-arrow" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4"/>
                    </svg>
                  </span>
                </button>
              )}
            </For>

            <button class="bl__nt is-import">
              <span class="bl__nt-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/>
                  <path d="M12 4v12M7 9l5-5 5 5"/>
                </svg>
              </span>
              <span class="bl__nt-text">
                <span class="bl__nt-title">Import file</span>
                <span class="bl__nt-sub">Drop a .wav / .mp3 / .mid into the project</span>
              </span>
              <span class="bl__nt-arrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTrackModal;
