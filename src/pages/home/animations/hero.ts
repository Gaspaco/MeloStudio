import { gsap } from "gsap";

export function animateHeroExit(refs: {
  heroRef: HTMLElement;
  heroLine1Ref: HTMLDivElement;
  heroLine2Ref: HTMLDivElement;
  scrollIndRef: HTMLDivElement;
}) {
  const heroExit = gsap.timeline({
    scrollTrigger: {
      trigger: refs.heroRef,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  heroExit
    .to(refs.heroLine1Ref, { clipPath: "inset(0 0 0 100%)", x: 60, ease: "none" }, 0)
    .to(refs.heroLine2Ref, { clipPath: "inset(0 100% 0 0)", x: -60, ease: "none" }, 0)
    .to(refs.scrollIndRef, { opacity: 0, ease: "none" }, 0);

  return heroExit;
}
