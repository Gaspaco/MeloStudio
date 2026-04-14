import { type Component, type Accessor, For } from "solid-js";
import { gsap } from "gsap";

const Nav: Component<{
  menuOpen: Accessor<boolean>;
  setMenuOpen: (v: boolean) => void;
  onLogin?: () => void;
  onSignup?: () => void;
}> = (props) => {
  let slabEl!: HTMLDivElement;
  let glowEl!: HTMLDivElement;
  let cubeEl!: HTMLDivElement;

  return (
    <>
      <nav class={`nav${props.menuOpen() ? " nav--hidden" : ""}`}>
        <span class="nav__logo">
          <span class="nav__logo-melo">Melo</span>
          <span class="nav__logo-studio">Studio</span>
        </span>

        {/* 3D Slab Widget */}
        <div
          ref={slabEl!}
          class="slab"
          onClick={() => props.setMenuOpen(!props.menuOpen())}
          onMouseMove={(e) => {
            if (props.menuOpen()) return;
            const rect = slabEl.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            gsap.to(slabEl, { rotateY: x * 18, rotateX: y * -12, duration: 0.4, ease: "power2.out" });
            gsap.to(glowEl, { opacity: 0.5, duration: 0.3 });
            gsap.to(cubeEl, { rotateY: x * 60, rotateX: y * -60, duration: 0.4, ease: "power2.out" });
          }}
          onMouseLeave={() => {
            gsap.to(slabEl, { rotateY: 0, rotateX: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" });
            gsap.to(glowEl, { opacity: 0, duration: 0.5 });
            gsap.to(cubeEl, { rotateY: 0, rotateX: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" });
          }}
        >
          <div ref={glowEl!} class="slab__glow" />
          <div class="slab__sheen" />
          <div ref={cubeEl!} class="slab__cube">
            <For each={["front", "back", "left", "right", "top", "bottom"]}>{(face) =>
              <div class="slab__cube-face" data-face={face}>
                <div class="slab__marquee">
                  <span>Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
                  <span>Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
                </div>
              </div>
            }</For>
          </div>
        </div>
      </nav>

      {/* Nav Menu Overlay */}
      <div class={`nav-menu${props.menuOpen() ? " nav-menu--open" : ""}`}>
        <div class="nav-menu__bg" />
        <div class="nav-menu__close" onClick={() => props.setMenuOpen(false)}>
          <svg class="nav-menu__close-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 12H5M5 12L11 6M5 12L11 18" />
          </svg>
        </div>
        <div class="nav-menu__left">
          <span class="nav-menu__eyebrow">Navigation</span>
          <span class="nav-menu__desc">Explore the features that make MeloStudio the most powerful browser-native DAW.</span>
        </div>
        <div class="nav-menu__right">
          <For each={["Timeline", "Mixer", "Engine", "Cloud", "Sign in"]}>{(label, i) =>
            <a
              class="nav-menu__row"
              style={{ "--i": i() } as any}
              onClick={label === "Sign in" ? () => { props.setMenuOpen(false); props.onLogin?.(); } : undefined}
            >
              <span class="nav-menu__num">{String(i() + 1).padStart(2, "0")}</span>
              <span class="nav-menu__divider" />
              <span class={`nav-menu__label${label === "Sign in" ? " nav-menu__label--accent" : ""}`}>
                <For each={label.split("")}>{(ch, ci) =>
                  <span class="nav-menu__char" style={{ "--ci": ci(), "--i": i() } as any}>{ch}</span>
                }</For>
              </span>
            </a>
          }</For>
        </div>
        <div class="nav-menu__bottom">
          <div class="nav-menu__socials">
            <a class="nav-menu__social-link" href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a class="nav-menu__social-link" href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a class="nav-menu__social-link" href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
            <a class="nav-menu__social-link" href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <div class="nav-menu__footer">
            <span>&copy; 2026 MeloStudio</span>
            <span>All rights reserved</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Nav;
