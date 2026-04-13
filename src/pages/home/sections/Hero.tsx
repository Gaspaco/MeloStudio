import type { Component } from "solid-js";

const Hero: Component<{
  heroRef: (el: HTMLElement) => void;
  heroTitleRef: (el: HTMLDivElement) => void;
  heroLine1Ref: (el: HTMLDivElement) => void;
  heroLine2Ref: (el: HTMLDivElement) => void;
  heroMetaRef: (el: HTMLDivElement) => void;
  scrollIndRef: (el: HTMLDivElement) => void;
}> = (props) => {
  return (
    <section ref={props.heroRef} class="hero">
      <div ref={props.heroTitleRef} class="hero__title">
        <div class="hero__clip">
          <div ref={props.heroLine1Ref} class="hero__word hero__word--pink">Melo</div>
        </div>
        <div class="hero__clip">
          <div ref={props.heroLine2Ref} class="hero__word hero__word--stroke">Studio</div>
        </div>
      </div>
      <div ref={props.heroMetaRef} class="hero__meta">
        <span>Browser-native DAW</span>
        <span class="hero__sep">/</span>
        <span>WASM Engine</span>
        <span class="hero__sep">/</span>
        <span>2026</span>
      </div>
      <div class="hero__scroll">
        <div ref={props.scrollIndRef} class="hero__scroll-line" />
      </div>
    </section>
  );
};

export default Hero;
