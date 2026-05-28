import { type Component, createEffect, onCleanup, onMount } from "solid-js";
import Peaks, { type PeaksInstance } from "peaks.js";
import { getAudioContext } from "~/lib/audio/context";

const AudioWaveformDisplay: Component<{ url?: string; color: string }> = (props) => {
  let containerEl: HTMLDivElement | undefined;
  let audioEl: HTMLAudioElement | undefined;
  let peaksInstance: PeaksInstance | null = null;
  // URL waiting to be rendered once the AudioContext is running
  let pendingUrl: string | null = null;

  const initPeaks = async (url: string) => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
    if (!containerEl || !audioEl) return;
    audioEl.src = url;

    // Peaks.js uses decodeAudioData which requires a running AudioContext.
    // Browsers start AudioContext in "suspended" state (autoplay policy) until
    // a user gesture resumes it. If we're not running yet, stash the URL and
    // let the statechange listener below retry after the first user interaction.
    const ac = getAudioContext();
    if (ac.state !== "running") {
      pendingUrl = url;
      return;
    }
    pendingUrl = null;

    Peaks.init({
      overview: {
        container: containerEl,
        waveformColor: props.color,
        showAxisLabels: false,
        playheadColor: "transparent",
        playheadTextColor: "transparent",
        axisGridlineColor: "transparent",
        highlightColor: "transparent",
        highlightOpacity: 0,
      },
      mediaElement: audioEl,
      webAudio: { audioContext: ac },
      keyboard: false,
    }, (err, peaks) => {
      if (err || !peaks) {
        console.warn("[AudioWaveformDisplay] peaks.js init failed:", err);
        return;
      }
      peaksInstance = peaks;
      const view = peaks.views.getView("overview");
      if (view) {
        view.enableSeek(false);
        view.showAxisLabels(false, { topMarkerHeight: 0, bottomMarkerHeight: 0 });
        view.setAmplitudeScale(1.0);
      }
    });
  };

  // When the AudioContext transitions to "running" (after the first user gesture),
  // initialize any waveform that was deferred because the context was suspended.
  onMount(() => {
    const ac = getAudioContext();
    const onStateChange = () => {
      if (ac.state === "running" && pendingUrl) {
        void initPeaks(pendingUrl);
      }
    };
    ac.addEventListener("statechange", onStateChange);
    onCleanup(() => ac.removeEventListener("statechange", onStateChange));
  });

  createEffect(() => {
    const url = props.url;
    if (url) void initPeaks(url);
  });

  onCleanup(() => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
  });

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <audio ref={(el) => { audioEl = el; }} style={{ display: "none" }} preload="metadata" />
      <div ref={(el) => { containerEl = el; }} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default AudioWaveformDisplay;
