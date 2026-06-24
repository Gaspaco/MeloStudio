import { gsap } from "gsap";

// `playSplash` is decided by the caller (Home) at mount time — before the boot
// veil marks the session "loaded" — so the splash animation plays exactly once
// per session and is skipped on later visits.
export function animateIntro(refs: {
  loaderRef: HTMLDivElement;
  loaderMeloRef: HTMLDivElement;
  loaderStudioRef: HTMLDivElement;
  heroLine1Ref: HTMLDivElement;
  heroLine2Ref: HTMLDivElement;
  scrollIndRef: HTMLDivElement;
}, playSplash: boolean) {
  if (!playSplash) {
    gsap.set(refs.loaderRef, { display: "none" });
  }

  const intro = gsap.timeline({ delay: playSplash ? 0.2 : 0 });

  if (playSplash) {
    const meloChars = refs.loaderMeloRef.querySelectorAll(".loader__char");
    const studioChars = refs.loaderStudioRef.querySelectorAll(".loader__char");

    intro
      .fromTo(meloChars, { yPercent: 120, opacity: 1 }, { yPercent: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: "power4.out", force3D: true }, 0)
      .fromTo(studioChars, { xPercent: 80, opacity: 0 }, { xPercent: 0, opacity: 1, stagger: 0.05, duration: 0.6, ease: "power3.out", force3D: true }, 0.4)
      .to(refs.loaderRef, { yPercent: -100, duration: 0.8, ease: "power4.inOut", force3D: true }, 1.4);
  }

  intro
    .fromTo(refs.heroLine1Ref, {
      clipPath: "inset(0 100% 0 0)", x: -60, y: 20,
    }, {
      clipPath: "inset(0 0% 0 0)", x: 0, y: 0, duration: 1.3, ease: "power4.inOut", force3D: true,
    }, playSplash ? 0.9 : 0)
    .fromTo(refs.heroLine2Ref, {
      clipPath: "inset(0 0 0 100%)", x: 60, y: 20,
    }, {
      clipPath: "inset(0 0 0 0%)", x: 0, y: 0, duration: 1.3, ease: "power4.inOut", force3D: true,
    }, playSplash ? 1.1 : 0.2)
    .fromTo(refs.scrollIndRef, { scaleY: 0 }, { scaleY: 1, duration: 0.8, transformOrigin: "top", force3D: true }, playSplash ? 2.1 : 1.2);

  return intro;
}
