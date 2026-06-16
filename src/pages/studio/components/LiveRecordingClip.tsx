import { type Component, onMount, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

interface Props {
  startPx: number;
  playheadPx: Accessor<number>;
  color: string;
}

const LiveRecordingClip: Component<Props> = (props) => {
  let wrap!: HTMLDivElement;
  let raf: number;

  onMount(() => {
    const tick = () => {
      wrap.style.width = `${Math.max(2, props.playheadPx() - props.startPx)}px`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  onCleanup(() => cancelAnimationFrame(raf));

  return (
    <div
      ref={wrap}
      class="bl__live-clip"
      style={{ left: `${props.startPx}px`, background: props.color }}
    />
  );
};

export default LiveRecordingClip;
