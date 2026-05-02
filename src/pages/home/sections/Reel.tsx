import { type Component, For, createSignal, onMount, onCleanup } from "solid-js";
import Peaks, { type PeaksInstance } from "peaks.js";
import { tracks } from "../data/tracks";

const Reel: Component<{
  reelRef: (el: HTMLElement) => void;
  dawWrapRef: (el: HTMLDivElement) => void;
}> = (props) => {
  let audioEl!: HTMLAudioElement;
  let waveformEl!: HTMLDivElement;
  let playheadEl!: HTMLDivElement;
  let peaksInstance: PeaksInstance | null = null;
  let rafHandle: number | null = null;

  const [playing, setPlaying] = createSignal(false);

  const updatePlayhead = () => {
    if (!audioEl || !playheadEl) return;
    const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
    playheadEl.style.left = `${pct}%`;
    rafHandle = requestAnimationFrame(updatePlayhead);
  };

  const togglePlay = () => {
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().catch(() => {});
      setPlaying(true);
      rafHandle = requestAnimationFrame(updatePlayhead);
    } else {
      audioEl.pause();
      setPlaying(false);
      if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    }
  };

  const stopAudio = () => {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.currentTime = 0;
    setPlaying(false);
    if (playheadEl) playheadEl.style.left = "0%";
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
  };

  onMount(() => {
    Peaks.init({
      overview: {
        container: waveformEl,
        waveformColor: "#ff69b4",
        playedWaveformColor: "#ff69b4",
        showAxisLabels: false,
        playheadColor: "transparent",
        playheadTextColor: "transparent",
        axisGridlineColor: "transparent",
        highlightColor: "transparent",
        highlightOpacity: 0,
      },
      mediaElement: audioEl,
      webAudio: { audioContext: new AudioContext() },
      keyboard: false,
      logger: console.debug.bind(console),
    }, (err, peaks) => {
      if (err || !peaks) return;
      peaksInstance = peaks;
      const view = peaks.views.getView("overview");
      if (view) {
        view.enableSeek(false);
        view.showAxisLabels(false, { topMarkerHeight: 0, bottomMarkerHeight: 0 });
        view.setAmplitudeScale(1.2);
      }
    });
  });

  onCleanup(() => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
  });

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
              <div class="daw__btn-stop" onClick={stopAudio} />
              <div class={`daw__btn-play${playing() ? " daw__btn-play--active" : ""}`} onClick={togglePlay} />
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
              <div ref={playheadEl!} class="daw__playhead" />
            </div>
          </div>

          {/* Bottom panel */}
          <div class="daw__bottom">
            <div class="daw__bottom-side">
              <span class="daw__bottom-label">hate-me</span>
              <span class="daw__bottom-sub">Waveform</span>
            </div>
            <div class="daw__waveform">
              <audio ref={audioEl!} src="/hate-me.mp3" preload="metadata" style={{ display: "none" }} />
              <div ref={waveformEl!} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Reel;
