import { type Component, createEffect, onCleanup, onMount } from "solid-js";
import type { PeaksInstance } from "peaks.js";
import { getExistingAudioContext, unlockAudioContext } from "~/lib/audio/context";

const AudioWaveformDisplay: Component<{ url?: string; color: string }> = (props) => {
  let containerEl: HTMLDivElement | undefined;
  let audioEl: HTMLAudioElement | undefined;
  let peaksInstance: PeaksInstance | null = null;
  // URL waiting to be rendered once the AudioContext is running
  let pendingUrl: string | null = null;
  // Last URL/color pair initialized or currently initializing. This prevents
  // Peaks.js from tearing down and rebuilding when a parent track gets a new
  // object reference but the rendered waveform did not actually change.
  let lastInitKey: string | null = null;

  const initPeaks = async (url: string) => {
    const initKey = `${url}\u0000${props.color}`;
    if (initKey === lastInitKey) return;
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
    if (!containerEl || !audioEl) return;

    // Peaks.js uses decodeAudioData which requires a running AudioContext.
    // Browsers start AudioContext in "suspended" state (autoplay policy) until
    // a user gesture resumes it. If we're not running yet, stash the URL and
    // let the statechange listener below retry after the first user interaction.
    const ac = getExistingAudioContext();
    if (!ac || ac.state !== "running") {
      pendingUrl = url;
      return;
    }
    pendingUrl = null;
    lastInitKey = initKey;
    audioEl.src = url;

    const { default: Peaks } = await import("peaks.js");
    Peaks.init({
      overview: {
        container: containerEl,
        waveformColor: props.color,
        backgroundColor: "transparent",
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
        lastInitKey = null;
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
    let ac = getExistingAudioContext();
    const onStateChange = () => {
      if (ac?.state === "running" && pendingUrl) {
        void initPeaks(pendingUrl);
      }
    };
    const onFirstGesture = () => {
      void unlockAudioContext().then(() => {
        ac = getExistingAudioContext();
        if (ac && pendingUrl) void initPeaks(pendingUrl);
      }).catch(() => {});
    };
    ac?.addEventListener("statechange", onStateChange);
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    onCleanup(() => {
      ac?.removeEventListener("statechange", onStateChange);
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    });
  });

  createEffect(() => {
    const url = props.url;
    if (url) void initPeaks(url);
  });

  onCleanup(() => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
    lastInitKey = null;
  });

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "transparent" }}>
      <audio ref={(el) => { audioEl = el; }} style={{ display: "none" }} preload="metadata" />
      <div ref={(el) => { containerEl = el; }} style={{ width: "100%", height: "100%", background: "transparent" }} />
    </div>
  );
};

export default AudioWaveformDisplay;
