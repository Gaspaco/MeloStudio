import type { Component, Accessor } from "solid-js";

const Manifesto: Component<{
  manifestoRef: (el: HTMLElement) => void;
  manifestoTextRef: (el: HTMLDivElement) => void;
  twText: Accessor<string>;
  twCursor: Accessor<boolean>;
}> = (props) => {
  return (
    <section ref={props.manifestoRef} class="manifesto">
      <div ref={props.manifestoTextRef} class="manifesto__text">
        <span class="manifesto__script">We</span>
        <span class="manifesto__sans">
          {props.twText()}
          <span class="manifesto__cursor" style={{ opacity: props.twCursor() ? 1 : 0 }}>|</span>
        </span>
      </div>
    </section>
  );
};

export default Manifesto;
