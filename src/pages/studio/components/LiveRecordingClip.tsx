import { type Component } from "solid-js";
import type { Accessor } from "solid-js";

interface Props {
  startPx: number;
  endPx: Accessor<number>;
  color: string;
}

const LiveRecordingClip: Component<Props> = (props) => {
  return (
    <div
      class="bl__live-clip"
      style={{
        left: `${props.startPx}px`,
        width: `${Math.max(2, props.endPx() - props.startPx)}px`,
        background: props.color,
      }}
    />
  );
};

export default LiveRecordingClip;
