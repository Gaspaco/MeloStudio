import { type Component } from "solid-js";
import type { Accessor, Setter } from "solid-js";

type Props = {
  text: Accessor<string>;
  onSetText: Setter<string>;
  onClose: () => void;
};

const LyricsPanel: Component<Props> = (props) => (
  <>
    <div class="bl__lyrics-overlay" onClick={props.onClose} />
    <aside class="bl__lyrics-panel">
      <div class="bl__lyrics-header">
        <div class="bl__lyrics-header-l">
          <span class="bl__lyrics-eyebrow">— Lyrics / Notes</span>
          <span class="bl__lyrics-hint">{props.text().length} chars</span>
        </div>
        <button class="bl__lyrics-x" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
      <textarea
        class="bl__lyrics-body"
        placeholder={"Write your lyrics, ideas,\nor session notes here…"}
        value={props.text()}
        onInput={(e) => props.onSetText(e.currentTarget.value)}
        spellcheck={false}
      />
      <div class="bl__lyrics-foot">
        <span class="bl__lyrics-foot-label">Session only · not saved to project</span>
      </div>
    </aside>
  </>
);

export default LyricsPanel;
