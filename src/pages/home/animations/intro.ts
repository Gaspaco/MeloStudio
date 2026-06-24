import { gsap } from "gsap";

// The loading screen is owned entirely by the boot veil (static MELO Studio
// logo that fades out) — see entry-server.tsx. The home page only reveals the
// hero; it no longer renders its own splash loader.
export function animateIntro(refs: {
  heroLine1Ref: HTMLDivElement;
  heroLine2Ref: HTMLDivElement;
  scrollIndRef: HTMLDivElement;
}) {
  const intro = gsap.timeline();

  intro
    .fromTo(refs.heroLine1Ref, {
      clipPath: "inset(0 100% 0 0)", x: -60, y: 20,
    }, {
      clipPath: "inset(0 0% 0 0)", x: 0, y: 0, duration: 1.3, ease: "power4.inOut", force3D: true,
    }, 0)
    .fromTo(refs.heroLine2Ref, {
      clipPath: "inset(0 0 0 100%)", x: 60, y: 20,
    }, {
      clipPath: "inset(0 0 0 0%)", x: 0, y: 0, duration: 1.3, ease: "power4.inOut", force3D: true,
    }, 0.2)
    .fromTo(refs.scrollIndRef, { scaleY: 0 }, { scaleY: 1, duration: 0.8, transformOrigin: "top", force3D: true }, 1.2);

  return intro;
}
