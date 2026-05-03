import { type Component, For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { SynthPreset } from "~/lib/audio/synth";
import type { UITrack } from "../types";

interface AdsrPath { stroke: string; fill: string; }

interface KeyboardPanelProps {
  tracks:          Accessor<UITrack[]>;
  selectedTrack:   Accessor<string | null>;
  synthPreset:     Accessor<SynthPreset>;
  octave:          Accessor<number>;
  activeNotes:     Accessor<Set<number>>;
  synthAttack:     Accessor<number>;
  synthDecay:      Accessor<number>;
  synthSustain:    Accessor<number>;
  synthRelease:    Accessor<number>;
  synthFilterFreq: Accessor<number>;
  adsrPath:        Accessor<AdsrPath>;
  onPressKey:       (midi: number) => void;
  onReleaseKey:     (midi: number) => void;
  onUpdatePreset:   (preset: SynthPreset) => void;
  onUpdateEnvelope: (a: number, d: number, s: number, r: number) => void;
  onUpdateFilter:   (freq: number) => void;
  onSetOctave:      (oct: number) => void;
  onCollapse:       () => void;
}

const KeyboardPanel: Component<KeyboardPanelProps> = (props) => {
  const selectedTrackData = () => props.tracks().find(t => t.id === props.selectedTrack());
  const isGuitarOrBass = () => {
    const t = selectedTrackData();
    return t?.type === "bass" || t?.type === "guitar";
  };

  const panelTitle = () => {
    const t = selectedTrackData();
    if (t?.type === "bass") return "Bass Synth";
    if (t?.type === "guitar") return "Guitar";
    return "Instruments";
  };

  const panelIcon = () => {
    const t = selectedTrackData();
    if (t?.type === "bass" || t?.type === "guitar") {
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
          <path d="M19 14 10 5"/><path d="M12 14 14 12"/><path d="m11 15 2-2"/>
          <path d="m14 8 2-2"/><path d="m15 9 2-2"/><path d="m18 11 2-2"/>
          <path d="M19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M6 6v12"/><path d="M10 6v12"/><path d="M14 6v12"/><path d="M18 6v12"/>
        <path d="M8 6v6"/><path d="M12 6v6"/><path d="M16 6v6"/>
      </svg>
    );
  };

  const renderFretboard = () => {
    const t = selectedTrackData();
    const preset = props.synthPreset();
    const strings = preset === "bass"
      ? [43, 38, 33, 28]
      : [64, 59, 55, 50, 45, 40];
    const strNames = preset === "bass"
      ? ["G", "D", "A", "E"]
      : ["e", "B", "G", "D", "A", "E"];
    const FRETS = Array.from({ length: 13 }, (_, i) => i);
    const SINGLE_DOTS = new Set([3, 5, 7, 9]);

    return (
      <div class="bl__fretboard">
        <div class="bl__fb-lblcol">
          <For each={strNames}>{(n) => <div class="bl__fb-lbl">{n}</div>}</For>
        </div>
        <div class="bl__fb-neck">
          <div class="bl__fb-dotrow">
            <For each={FRETS}>
              {(fret) => (
                <div class={`bl__fb-dotcell${SINGLE_DOTS.has(fret) ? " has-dot" : ""}${fret === 12 ? " has-double" : ""}`} />
              )}
            </For>
          </div>
          <For each={strings}>
            {(openStr, sIdx) => (
              <div class="bl__fb-row" data-sn={sIdx()}>
                <For each={FRETS}>
                  {(fret) => {
                    const midi = openStr + fret;
                    return (
                      <div
                        class={`bl__fb-cell${fret === 0 ? " is-nut" : ""}${props.activeNotes().has(midi) ? " is-on" : ""}`}
                        onMouseDown={() => props.onPressKey(midi)}
                        onMouseUp={() => props.onReleaseKey(midi)}
                        onMouseLeave={() => props.activeNotes().has(midi) && props.onReleaseKey(midi)}
                        onTouchStart={(e) => { e.preventDefault(); props.onPressKey(midi); }}
                        onTouchEnd={(e) => { e.preventDefault(); props.onReleaseKey(midi); }}
                      />
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    );
  };

  const renderPianoKeys = () => {
    const startMidi = 12 * (props.octave() + 1);
    const totalNotes = 24;
    const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
    const noteName = (m: number) => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][m % 12];
    const KEY_LBL: Record<number, string> = {
      0:"A",1:"W",2:"S",3:"E",4:"D",5:"F",6:"T",7:"G",8:"Y",9:"H",10:"U",11:"J",
      12:"K",13:"O",14:"L",15:"P",16:";",
    };
    const notes = Array.from({ length: totalNotes }, (_, i) => startMidi + i);

    return (
      <>
        <div class="bl__kb-whites">
          <For each={notes.filter(m => !isBlack(m))}>
            {(m) => (
              <button
                class={`bl__wk ${props.activeNotes().has(m) ? "is-on" : ""}`}
                onMouseDown={() => props.onPressKey(m)}
                onMouseUp={() => props.onReleaseKey(m)}
                onMouseLeave={() => props.activeNotes().has(m) && props.onReleaseKey(m)}
                onTouchStart={(e) => { e.preventDefault(); props.onPressKey(m); }}
                onTouchEnd={(e) => { e.preventDefault(); props.onReleaseKey(m); }}
              >
                <span class="bl__wk-shortcut">{KEY_LBL[m - startMidi] ?? ""}</span>
                <span class="bl__wk-name">{noteName(m)}{Math.floor(m / 12) - 1}</span>
              </button>
            )}
          </For>
        </div>
        <div class="bl__kb-blacks">
          <For each={notes.filter(m => !isBlack(m))}>
            {(m) => {
              const next = m + 1;
              const hasBlack = isBlack(next);
              return (
                <div class="bl__bk-slot">
                  <Show when={hasBlack}>
                    <button
                      class={`bl__bk ${props.activeNotes().has(next) ? "is-on" : ""}`}
                      onMouseDown={(e) => { e.stopPropagation(); props.onPressKey(next); }}
                      onMouseUp={(e) => { e.stopPropagation(); props.onReleaseKey(next); }}
                      onMouseLeave={() => props.activeNotes().has(next) && props.onReleaseKey(next)}
                      onTouchStart={(e) => { e.preventDefault(); props.onPressKey(next); }}
                      onTouchEnd={(e) => { e.preventDefault(); props.onReleaseKey(next); }}
                    >
                      <span class="bl__bk-shortcut">{KEY_LBL[next - startMidi] ?? ""}</span>
                    </button>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </>
    );
  };

  return (
    <section class="bl__kb-panel">
      <div class="bl__dp-head">
        <div class="bl__dp-title">
          <span class="bl__dp-icon" style={{ color: "#3ee08b", display: "flex", "align-items": "center", "justify-content": "center" }}>
            {panelIcon()}
          </span>
          <span>{panelTitle()}</span>

          <Show when={!isGuitarOrBass()}>
            <div class="bl__preset-row">
              <For each={[
                { id: "piano" as SynthPreset, label: "Piano" },
                { id: "guitar" as SynthPreset, label: "Guitar" },
                { id: "bass" as SynthPreset, label: "Bass" },
                { id: "lead" as SynthPreset, label: "Lead" },
                { id: "pad" as SynthPreset, label: "Pad" },
              ]}>
                {(p) => (
                  <button
                    class={`bl__preset ${props.synthPreset() === p.id ? "is-on" : ""}`}
                    onClick={() => props.onUpdatePreset(p.id)}
                  >{p.label}</button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="bl__dp-actions">
          <div class="bl__oct-stepper" role="group" aria-label="Octave">
            <button
              class="bl__oct-btn"
              onClick={() => props.onSetOctave(Math.max(1, props.octave() - 1))}
              title="Octave down" aria-label="Octave down"
              disabled={props.octave() <= 1}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h8"/></svg>
            </button>
            <span class="bl__oct-readout">
              <span class="bl__oct-readout-label">Oct</span>
              <span class="bl__oct-readout-val">{props.octave()}</span>
            </span>
            <button
              class="bl__oct-btn"
              onClick={() => props.onSetOctave(Math.min(7, props.octave() + 1))}
              title="Octave up" aria-label="Octave up"
              disabled={props.octave() >= 7}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 4v8M4 8h8"/></svg>
            </button>
          </div>

          <button class="bl__icon-btn bl__icon-btn--collapse" onClick={props.onCollapse} title="Collapse panel" aria-label="Collapse">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
          </button>
        </div>
      </div>

      {/* Lead / Pad ADSR editor */}
      <Show when={props.synthPreset() === "lead" || props.synthPreset() === "pad"}>
        <div class={`bl__synth-edit ${props.synthPreset() === "pad" ? "is-pad" : "is-lead"}`}>
          <svg class="bl__adsr-viz" viewBox="0 0 200 52" preserveAspectRatio="none">
            <path d={props.adsrPath().fill}
              fill={props.synthPreset() === "pad" ? "rgba(163,116,247,0.12)" : "rgba(224,82,151,0.12)"}
            />
            <path d={props.adsrPath().stroke} fill="none"
              stroke={props.synthPreset() === "pad" ? "#a374f7" : "#e05297"}
              stroke-width="1.5" stroke-linejoin="round"
            />
            <text x="2"   y="50" class="bl__adsr-lbl">A</text>
            <text x="52"  y="50" class="bl__adsr-lbl">D</text>
            <text x="105" y="50" class="bl__adsr-lbl">S</text>
            <text x="158" y="50" class="bl__adsr-lbl">R</text>
          </svg>

          <div class="bl__synth-sliders">
            <div class="bl__synth-param">
              <label class="bl__synth-lbl">Attack</label>
              <input type="range" class="bl__synth-range" min="0.001" max="2" step="0.001"
                value={props.synthAttack()}
                onInput={(e) => props.onUpdateEnvelope(+e.currentTarget.value, props.synthDecay(), props.synthSustain(), props.synthRelease())}
              />
              <span class="bl__synth-val">{props.synthAttack() < 0.1 ? `${Math.round(props.synthAttack() * 1000)}ms` : `${props.synthAttack().toFixed(2)}s`}</span>
            </div>
            <div class="bl__synth-param">
              <label class="bl__synth-lbl">Decay</label>
              <input type="range" class="bl__synth-range" min="0.01" max="2" step="0.01"
                value={props.synthDecay()}
                onInput={(e) => props.onUpdateEnvelope(props.synthAttack(), +e.currentTarget.value, props.synthSustain(), props.synthRelease())}
              />
              <span class="bl__synth-val">{props.synthDecay() < 0.1 ? `${Math.round(props.synthDecay() * 1000)}ms` : `${props.synthDecay().toFixed(2)}s`}</span>
            </div>
            <div class="bl__synth-param">
              <label class="bl__synth-lbl">Sustain</label>
              <input type="range" class="bl__synth-range" min="0" max="1" step="0.01"
                value={props.synthSustain()}
                onInput={(e) => props.onUpdateEnvelope(props.synthAttack(), props.synthDecay(), +e.currentTarget.value, props.synthRelease())}
              />
              <span class="bl__synth-val">{Math.round(props.synthSustain() * 100)}%</span>
            </div>
            <div class="bl__synth-param">
              <label class="bl__synth-lbl">Release</label>
              <input type="range" class="bl__synth-range" min="0.01" max="4" step="0.01"
                value={props.synthRelease()}
                onInput={(e) => props.onUpdateEnvelope(props.synthAttack(), props.synthDecay(), props.synthSustain(), +e.currentTarget.value)}
              />
              <span class="bl__synth-val">{props.synthRelease() < 0.1 ? `${Math.round(props.synthRelease() * 1000)}ms` : `${props.synthRelease().toFixed(2)}s`}</span>
            </div>
            <div class="bl__synth-param bl__synth-param--wide">
              <label class="bl__synth-lbl">Cutoff</label>
              <input type="range" class="bl__synth-range" min="100" max="8000" step="50"
                value={props.synthFilterFreq()}
                onInput={(e) => props.onUpdateFilter(+e.currentTarget.value)}
              />
              <span class="bl__synth-val">{props.synthFilterFreq() >= 1000 ? `${(props.synthFilterFreq() / 1000).toFixed(1)}kHz` : `${props.synthFilterFreq()}Hz`}</span>
            </div>
          </div>
        </div>
      </Show>

      <div class="bl__kb">
        <Show when={isGuitarOrBass()} fallback={renderPianoKeys()}>
          {renderFretboard()}
        </Show>
      </div>

      <div class="bl__kb-hint">
        Type <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>\u2026 to play. <kbd>Z</kbd>/<kbd>X</kbd> change octave.
      </div>
    </section>
  );
};

export default KeyboardPanel;
