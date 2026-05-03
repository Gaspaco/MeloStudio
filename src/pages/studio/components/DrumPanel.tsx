import { type Component, For } from "solid-js";
import type { Accessor } from "solid-js";
import type { StepPattern } from "~/lib/audio/stepSeq";
import { DRUM_LABEL } from "../types";

interface DrumPanelProps {
  pattern:     Accessor<StepPattern>;
  currentStep: Accessor<number>;
  drumSteps:   Accessor<number>;
  drumSwing:   Accessor<number>;
  onToggleStep:        (rowIdx: number, stepIdx: number) => void;
  onCycleStepVelocity: (rowIdx: number, stepIdx: number) => void;
  onToggleRowMute:     (rowIdx: number) => void;
  onUpdateRowGain:     (rowIdx: number, db: number) => void;
  onUpdateSwing:       (amount: number) => void;
  onUpdateDrumSteps:   (steps: number) => void;
  onClearPattern:      () => void;
  onCollapse:          () => void;
}

const DrumPanel: Component<DrumPanelProps> = (props) => {
  return (
    <section class="bl__drum-panel">
      <div class="bl__dp-head">
        <div class="bl__dp-title">
          <span class="bl__dp-icon" style={{ color: "#f5b53e", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 4c-4.4 0-8 1.6-8 3.5s3.6 3.5 8 3.5 8-1.6 8-3.5-3.6-3.5-8-3.5z"/>
              <path d="M4 7.5v9c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-9"/>
              <path d="M12 11v6"/>
            </svg>
          </span>
          <span>Drum Machine</span>
          <span class="bl__dp-step">
            {props.currentStep() < 0 ? "" : `Step ${props.currentStep() + 1}/${props.drumSteps()}`}
          </span>
        </div>

        <div class="bl__dp-controls">
          <div class="bl__dp-ctrl-group">
            <span class="bl__dp-ctrl-label">Steps</span>
            <div class="bl__dp-steps-toggle">
              <button class={`bl__dp-steps-btn ${props.drumSteps() === 16 ? "is-on" : ""}`} onClick={() => props.onUpdateDrumSteps(16)}>16</button>
              <button class={`bl__dp-steps-btn ${props.drumSteps() === 32 ? "is-on" : ""}`} onClick={() => props.onUpdateDrumSteps(32)}>32</button>
            </div>
          </div>

          <div class="bl__dp-ctrl-group">
            <span class="bl__dp-ctrl-label">
              Swing <span class="bl__dp-ctrl-val">{Math.round(props.drumSwing() * 100)}%</span>
            </span>
            <input
              class="bl__dp-swing"
              type="range" min="0" max="0.5" step="0.01"
              value={props.drumSwing()}
              onInput={(e) => props.onUpdateSwing(parseFloat(e.currentTarget.value))}
            />
          </div>

          <button class="bl__icon-btn bl__icon-btn--collapse" onClick={props.onClearPattern} title="Clear all steps" aria-label="Clear">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 5h10"/><path d="M5 5V3.5A1 1 0 0 1 6 2.5h4A1 1 0 0 1 11 3.5V5"/>
              <path d="M4 5l.7 8a1.2 1.2 0 0 0 1.2 1.1h4.2a1.2 1.2 0 0 0 1.2-1.1L12 5"/>
            </svg>
          </button>

          <button class="bl__icon-btn bl__icon-btn--collapse" onClick={props.onCollapse} title="Collapse panel" aria-label="Collapse">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="bl__dp-grid">
        <For each={props.pattern().rows}>
          {(row, rowIdx) => (
            <div class={`bl__dp-row ${row.muted ? "is-muted" : ""}`}>
              <div class="bl__dp-rowlabel">
                <button
                  class={`bl__dp-mute ${row.muted ? "is-muted" : ""}`}
                  onClick={() => props.onToggleRowMute(rowIdx())}
                  title={row.muted ? "Unmute" : "Mute"}
                >M</button>
                <span class="bl__dp-rowname">{DRUM_LABEL[row.drum] ?? row.drum}</span>
                <input
                  class="bl__dp-vol"
                  type="range" min="-20" max="6" step="1"
                  value={row.gainDb}
                  onChange={(e) => props.onUpdateRowGain(rowIdx(), parseInt(e.currentTarget.value, 10))}
                  title={`Volume: ${row.gainDb}dB`}
                />
              </div>
              <div class="bl__dp-cells" style={{ "grid-template-columns": `repeat(${props.drumSteps()}, 1fr)` }}>
                <For each={row.velocities}>
                  {(v, stepIdx) => (
                    <button
                      class={[
                        "bl__dp-cell",
                        v >= 0.9 ? "is-vel-hi" : v >= 0.5 ? "is-vel-med" : v > 0 ? "is-vel-lo" : "",
                        props.currentStep() === stepIdx() ? "is-cursor" : "",
                        stepIdx() % 4 === 0 ? "is-down" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => props.onToggleStep(rowIdx(), stepIdx())}
                      onContextMenu={(e) => { e.preventDefault(); props.onCycleStepVelocity(rowIdx(), stepIdx()); }}
                      aria-label={`${row.drum} step ${stepIdx() + 1}`}
                    />
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </section>
  );
};

export default DrumPanel;
