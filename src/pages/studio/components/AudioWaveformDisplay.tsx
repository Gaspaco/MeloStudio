import { type Component, createEffect, onCleanup } from "solid-js";
import Peaks, { type PeaksInstance } from "peaks.js";
import { getAudioContext } from "~/lib/audio/context";

const AudioWaveformDisplay: Component<{ url?: string; color: string }> = (props) => {
  let containerEl!: HTMLDivElement;
  let audioEl!: HTMLAudioElement;
  let peaksInstance: PeaksInstance | null = null;

  const initPeaks = (url: string) => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
    if (!containerEl || !audioEl) return;
    audioEl.src = url;
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
      webAudio: { audioContext: getAudioContext() },
      keyboard: false,
    }, (err, peaks) => {
      if (err || !peaks) return;
      peaksInstance = peaks;
      const view = peaks.views.getView("overview");
      if (view) {
        view.enableSeek(false);
        view.showAxisLabels(false, { topMarkerHeight: 0, bottomMarkerHeight: 0 });
        view.setAmplitudeScale(1.0);
      }
    });
  };

  createEffect(() => {
    const url = props.url;
    if (url) initPeaks(url);
  });

  onCleanup(() => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
  });

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <audio ref={audioEl!} style={{ display: "none" }} preload="metadata" />
      <div ref={containerEl!} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default AudioWaveformDisplay;
