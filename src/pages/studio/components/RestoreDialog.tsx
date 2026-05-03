import { type Component } from "solid-js";

type Props = {
  onRestore: () => void;
  onDiscard: () => void;
};

const RestoreDialog: Component<Props> = (props) => (
  <div class="db__pm-overlay">
    <div class="db__pm" onClick={(e) => e.stopPropagation()}>
      <div class="db__pm-meta">
        <span>MeloStudio</span>
        <span class="db__pm-sep">/</span>
        <span>Studio</span>
        <span class="db__pm-sep">/</span>
        <strong>Session found</strong>
      </div>
      <div class="db__pm-display">
        <p class="db__pm-line">Restore</p>
        <p class="db__pm-line db__pm-line--pink">Session?</p>
      </div>
      <p style={{ "font-family": "var(--font-mono, monospace)", "font-size": "0.78rem", color: "var(--text-secondary)", "line-height": "1.65", "margin-top": "-0.5rem" }}>
        You have tracks, clips and beat patterns from a previous session.
        Restore to pick up where you left off, or start fresh.
      </p>
      <div class="db__pm-row">
        <button class="db__pm-btn db__pm-btn--primary" onClick={props.onRestore}>Restore session</button>
        <button class="db__pm-btn db__pm-btn--ghost" onClick={props.onDiscard}>Start fresh</button>
      </div>
    </div>
  </div>
);

export default RestoreDialog;
