import { type Component, For } from "solid-js";
import { tracks } from "../data/tracks";

const Reel: Component<{
  reelRef: (el: HTMLElement) => void;
  dawWrapRef: (el: HTMLDivElement) => void;
}> = (props) => {
  return (
    <section ref={props.reelRef} class="reel">
      <div ref={props.dawWrapRef} class="reel__inner">
        <div class="daw">
          {/* Toolbar */}
          <div class="daw__toolbar">
            <div class="daw__tabs">
              <span class="daw__tab daw__tab--active">Arrange</span>
              <span class="daw__tab">Mix</span>
              <span class="daw__tab">Master</span>
            </div>
            <div class="daw__controls">
              <div class="daw__btn-stop" />
              <div class="daw__btn-play" />
              <div class="daw__btn-rec" />
            </div>
            <div class="daw__info">
              <div class="daw__pill">128 <span>BPM</span></div>
              <div class="daw__pill">A min</div>
              <div class="daw__pill">4/4</div>
              <div class="daw__time">01:24.08</div>
            </div>
          </div>

          {/* Main area */}
          <div class="daw__body">
            {/* Sidebar */}
            <div class="daw__sidebar">
              <For each={tracks}>{(t) =>
                <div class="daw__label">
                  <div class="daw__strip" style={{ background: t.color }} />
                  <div class="daw__label-inner">
                    <span class="daw__track-name">{t.label}</span>
                    <div class="daw__track-meta">
                      <span class="daw__mute">M</span>
                      <span class="daw__solo">S</span>
                      <div class="daw__vol">
                        <div class="daw__vol-fill" style={{ width: `${t.vol}%`, background: t.color }} />
                      </div>
                    </div>
                  </div>
                </div>
              }</For>
            </div>

            {/* Timeline */}
            <div class="daw__timeline">
              <div class="daw__rulers">
                <For each={Array.from({ length: 33 })}>{(_, i) =>
                  <div class="daw__ruler">
                    {i() % 4 === 0 && <span>{Math.floor(i() / 4) + 1}</span>}
                  </div>
                }</For>
              </div>
              <div class="daw__tracks">
                <For each={tracks}>{(t) =>
                  <div class="daw__track">
                    <For each={t.blocks}>{(b) =>
                      <div
                        class="daw__block"
                        style={{
                          left: `${b.x}%`,
                          width: `${b.w}%`,
                          background: t.color,
                        }}
                      />
                    }</For>
                  </div>
                }</For>
              </div>
              <div class="daw__playhead" />
            </div>
          </div>

          {/* Bottom panel */}
          <div class="daw__bottom">
            <div class="daw__bottom-side">
              <span class="daw__bottom-label">Lead Vox</span>
              <span class="daw__bottom-sub">Waveform</span>
            </div>
            <div class="daw__waveform">
              <For each={Array.from({ length: 80 })}>{() =>
                <div class="daw__wav-bar" style={{ height: `${12 + Math.random() * 76}%` }} />
              }</For>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Reel;
