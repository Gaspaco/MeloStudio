import { type Component, For } from "solid-js";

const Loader: Component<{
  ref: (el: HTMLDivElement) => void;
  meloRef: (el: HTMLDivElement) => void;
  studioRef: (el: HTMLDivElement) => void;
}> = (props) => {
  return (
    <div ref={props.ref} class="loader">
      <div ref={props.meloRef} class="loader__melo">
        <For each={"MELO".split("")}>{(ch) =>
          <span class="loader__char">{ch}</span>
        }</For>
      </div>
      <div ref={props.studioRef} class="loader__studio">
        <For each={"Studio".split("")}>{(ch) =>
          <span class="loader__char">{ch}</span>
        }</For>
      </div>
    </div>
  );
};

export default Loader;
