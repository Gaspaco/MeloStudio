import { type Component, Index, Show, For } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { KeyboardMusic, Drum, AudioWaveform, MicVocal, Disc2, Guitar } from "lucide-solid";
import { type TrackType, type UITrack, TRACK_DEFS } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRACK_ICON_MAP: Record<string, Component<any>> = {
  instrument: KeyboardMusic, drum: Drum, bass: AudioWaveform,
  voice: MicVocal, sampler: Disc2, guitar: Guitar,
};
const TrackIcon: Component<{ name: string }> = (props) => {
  const Icon = TRACK_ICON_MAP[props.name];
  return Icon ? <Icon size={18} stroke-width={1.4} aria-hidden="true" /> : null;
};

type Props = {
  tracks: Accessor<UITrack[]>;
  selectedTrack: Accessor<string | null>;
  showAddMenu: Accessor<boolean>;
  onSelectTrack: Setter<string | null>;
  onPatchTrack: (id: string, patch: Partial<UITrack>) => void;
  onDeleteTrack: (id: string) => void;
  onAddTrack: (type: TrackType, openModal?: boolean) => void;
  onSetShowAddMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  onShowNewTrack: () => void;
};

const TracksSidebar: Component<Props> = (props) => (
  <aside class="bl__tracks-side">
    <div class="bl__add-row">
      <div class="bl__add-wrap">
        <button class="bl__add-track" onClick={() => props.onSetShowAddMenu(v => !v)}>
          <span class="bl__add-plus">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
          </span>
          <span>Add Track</span>
        </button>

        <Show when={props.showAddMenu()}>
          <div class="bl__add-menu-backdrop" onClick={() => props.onSetShowAddMenu(false)} />
          <div class="bl__add-menu" onClick={(e) => e.stopPropagation()}>
            <div class="bl__add-menu-head">
              <span class="bl__add-menu-eyebrow">— New source</span>
            </div>
            <For each={TRACK_DEFS}>
              {(def) => (
                <button
                  class={`bl__add-menu-item ${def.ready ? "" : "is-locked"}`}
                  disabled={!def.ready}
                  onClick={() => {
                    if (!def.ready) return;
                    props.onAddTrack(def.type);
                    props.onSetShowAddMenu(false);
                  }}
                >
                  <span class="bl__add-menu-icon" aria-hidden="true"><TrackIcon name={def.icon} /></span>
                  <span class="bl__add-menu-text">
                    <span class="bl__add-menu-title">
                      {def.label}
                      <Show when={!def.ready}><span class="bl__nt-soon">Soon</span></Show>
                    </span>
                    <span class="bl__add-menu-tag">{def.tag}</span>
                  </span>
                </button>
              )}
            </For>
            <button class="bl__add-menu-foot" onClick={() => { props.onSetShowAddMenu(false); props.onShowNewTrack(); }}>
              Browse all sources
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </button>
          </div>
        </Show>
      </div>
      <button class="bl__add-tool" title="Track tools" disabled>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3z"/><path d="M9 4l3 3"/></svg>
      </button>
      <button class="bl__add-tool" title="Track view" disabled>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 8h2M6 4v8M10 6v4M14 8h-1"/><circle cx="6" cy="4" r="1" fill="currentColor"/><circle cx="10" cy="6" r="1" fill="currentColor"/></svg>
      </button>
    </div>

    <button class="bl__automix">
      <span class="bl__automix-glow" />
      <span class="bl__automix-spark">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z"/></svg>
      </span>
      <span class="bl__automix-text">
        <span class="bl__automix-label">AutoMix</span>
        <span class="bl__automix-sub">AI · Mix &amp; master</span>
      </span>
      <svg class="bl__automix-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
    </button>

    <div class="bl__track-list">
      <For each={props.tracks()}>
        {(t) => (
          <div
            class={`bl__track ${props.selectedTrack() === t.id ? "is-sel" : ""}`}
            style={{ "--tc": t.color }}
            onClick={() => props.onSelectTrack(t.id)}
          >
            <div class="bl__track-col">
              <TrackIcon name={TRACK_DEFS.find(d => d.type === t.type)?.icon ?? ""} />
            </div>
            <div class="bl__track-body">
              <div class="bl__track-head">
                <input
                  class="bl__track-name"
                  value={t.name}
                  onInput={(e) => props.onPatchTrack(t.id, { name: e.currentTarget.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  class="bl__track-x"
                  onClick={(e) => { e.stopPropagation(); props.onDeleteTrack(t.id); }}
                  title="Delete track"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                </button>
              </div>
              <div class="bl__track-controls" onClick={(e) => e.stopPropagation()}>
                <button class={`bl__chip-btn ${t.muted ? "is-on-mute" : ""}`} title="Mute"
                  onClick={() => props.onPatchTrack(t.id, { muted: !t.muted })}>M</button>
                <button class={`bl__chip-btn ${t.solo ? "is-on-solo" : ""}`} title="Solo"
                  onClick={() => props.onPatchTrack(t.id, { solo: !t.solo })}>S</button>
                <input class="bl__slider" type="range" min="0" max="1" step="0.01"
                  value={t.volume}
                  onInput={(e) => props.onPatchTrack(t.id, { volume: parseFloat(e.currentTarget.value) })}
                  title={`Volume: ${Math.round(t.volume * 100)}%`}
                />
                <span class="bl__slider-val">{Math.round(t.volume * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </For>
      <Show when={props.tracks().length === 0}>
        <div class="bl__sidebar-hint" />
      </Show>
    </div>
  </aside>
);

export default TracksSidebar;
