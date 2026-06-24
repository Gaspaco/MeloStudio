import { gsap } from "gsap";

export function animateIntro(refs: {
  loaderRef: HTMLDivElement;
  loaderMeloRef: HTMLDivElement;
  loaderStudioRef: HTMLDivElement;
  heroLine1Ref: HTMLDivElement;
  heroLine2Ref: HTMLDivElement;
  scrollIndRef: HTMLDivElement;
}) {
  // Skip the splash loader on tab re-focus within the same session — only plays on true first load
  const hasLoaded = (() => {
    try { return sessionStorage.getItem("melostudio_loaded"); }
    catch { return null; }
  })();

  if (hasLoaded) {
    gsap.set(refs.loaderRef, { display: "none" });
  }

  const intro = gsap.timeline({ delay: hasLoaded ? 0 : 0.2 });

  if (!hasLoaded) {
    const meloChars = refs.loaderMeloRef.querySelectorAll(".loader__char");
    const studioChars = refs.loaderStudioRef.querySelectorAll(".loader__char");

    intro
      .fromTo(meloChars, { yPercent: 120, opacity: 1 }, { yPercent: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: "power4.out", force3D: true }, 0)
      .fromTo(studioChars, { xPercent: 80, opacity: 0 }, { xPercent: 0, opacity: 1, stagger: 0.05, duration: 0.6, ease: "power3.out", force3D: true }, 0.4)
      .to(refs.loaderRef, { yPercent: -100, duration: 0.8, ease: "power4.inOut", force3D: true }, 1.4);

    try { sessionStorage.setItem("melostudio_loaded", "1"); }
    catch {}
  }

  intro
    .fromTo(refs.heroLine1Ref, {
      clipPath: "inset(0 100% 0 0)", x: -60, y: 20,
    }, {
      clipPath: "inset(0 0% 0 0)", x: 0, y: 0, duration: 1.3, ease: "power4.inOut", force3D: true,
    }, hasLoaded ? 0 : 0.9)
    .fromTo(refs.heroLine2Ref, {
      clipPath: "inset(0 0 0 100%)", x: 60, y: 20,
    }, {
      clipPath: "inset(0 0 0 0%)", x: 0, y: 0, duration: 1.3, ease: "power4.inOut", force3D: true,
    }, hasLoaded ? 0.2 : 1.1)
    .fromTo(refs.scrollIndRef, { scaleY: 0 }, { scaleY: 1, duration: 0.8, transformOrigin: "top", force3D: true }, hasLoaded ? 1.2 : 2.1);

  return intro;
}
