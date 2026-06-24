import { type Component, For } from "solid-js";

const Loader: Component<{
  ref?: (el: HTMLDivElement) => void;
  meloRef?: (el: HTMLDivElement) => void;
  studioRef?: (el: HTMLDivElement) => void;
}> = (props) => {
  return (
    <div ref={(el) => props.ref?.(el)} class="loader">
      <div ref={(el) => props.meloRef?.(el)} class="loader__melo">
        <For each={"MELO".split("")}>{(ch) =>
          <span class="loader__char">{ch}</span>
        }</For>
      </div>
      <div ref={(el) => props.studioRef?.(el)} class="loader__studio">
        <For each={"Studio".split("")}>{(ch) =>
          <span class="loader__char">{ch}</span>
        }</For>
      </div>
    </div>
  );
};

export default Loader;
