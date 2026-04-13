import { type Component, For } from "solid-js";
import { capabilities } from "../data/capabilities";

const Capabilities: Component<{
  hScrollRef: (el: HTMLElement) => void;
  hScrollTrackRef: (el: HTMLDivElement) => void;
  orbRef: (el: HTMLDivElement) => void;
}> = (props) => {
  return (
    <section ref={props.hScrollRef} class="h-scroll">
      <div ref={props.hScrollTrackRef} class="h-scroll__track">
        {/* Intro panel */}
        <div class="h-panel h-panel--intro">
          <span class="h-panel__intro-eye">What it does</span>
          <h2 class="h-panel__intro-title">
            Four pillars.<br />
            <span class="h-panel__intro-stroke">Zero compromise.</span>
          </h2>
        </div>

        {/* Capability panels */}
        <For each={capabilities}>{(cap) =>
          <div class="h-panel">
            <span class="h-panel__num" style={{ color: cap.accent }}>{cap.num}</span>
            <h3 class="h-panel__title">
              <span class="h-panel__title-script">{cap.titleScript}</span>
              {cap.titleBold}
            </h3>
            <p class="h-panel__desc">{cap.desc}</p>
            <div class="h-panel__tags">
              <For each={cap.stats}>{(s) =>
                <span class="h-panel__tag">{s}</span>
              }</For>
            </div>
          </div>
        }</For>

        {/* End panel */}
        <div class="h-panel h-panel--end">
          <div ref={props.orbRef} class="h-panel--end__orb">
            <div class="h-panel--end__ring h-panel--end__ring--1" />
            <div class="h-panel--end__ring h-panel--end__ring--2" />
            <div class="h-panel--end__ring h-panel--end__ring--3" />
            <div class="h-panel--end__core" />
            <div class="h-panel--end__glow" />
          </div>
          <div class="h-panel--end__chevrons">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Capabilities;
