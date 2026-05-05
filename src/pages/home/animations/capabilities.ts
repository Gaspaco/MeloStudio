import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function animateCapabilities(refs: {
  hScrollRef: HTMLElement;
  hScrollTrackRef: HTMLDivElement;
}) {
  const panels = gsap.utils.toArray(".h-panel") as HTMLElement[];
  if (!panels.length || !refs.hScrollTrackRef) return;

  const totalWidth = refs.hScrollTrackRef.scrollWidth;
  const scrollDistance = Math.max(1, totalWidth - window.innerWidth);

  const scrollTween = gsap.to(refs.hScrollTrackRef, {
    x: -scrollDistance,
    ease: "none",
    force3D: true,
    scrollTrigger: {
      trigger: refs.hScrollRef,
      start: "top top",
      end: () => `+=${scrollDistance}`,
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
    },
  });

  // track .closing entry directly to sidestep pin-spacer offset issues
  const closingSection = document.querySelector(".closing");

  if (closingSection) {
    // willChange before animating filter/opacity keeps it on its own layer
    gsap.set(refs.hScrollTrackRef, { willChange: "transform, filter, opacity" });
    gsap.fromTo(
      refs.hScrollTrackRef,
      { filter: "blur(0px)", scale: 1, opacity: 1 },
      {
        filter: "blur(14px)",
        scale: 0.92,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: closingSection,
          start: "top bottom",
          end: "top top",
          scrub: true,
        },
      }
    );
  }

  panels.forEach((panel) => {
    const num = panel.querySelector(".h-panel__num") as HTMLElement;
    const title = panel.querySelector(".h-panel__title") as HTMLElement;
    const desc = panel.querySelector(".h-panel__desc") as HTMLElement;
    const tags = panel.querySelectorAll(".h-panel__tag");
    const introEye = panel.querySelector(".h-panel__intro-eye") as HTMLElement;
    const introTitle = panel.querySelector(".h-panel__intro-title") as HTMLElement;
    const endOrb = panel.querySelector(".h-panel--end__orb") as HTMLElement;
    const endRings = panel.querySelectorAll(".h-panel--end__ring");
    const endCore = panel.querySelector(".h-panel--end__core") as HTMLElement;
    const endGlow = panel.querySelector(".h-panel--end__glow") as HTMLElement;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: panel,
        containerAnimation: scrollTween,
        start: "left 80%",
        toggleActions: "play none none reverse",
      } as ScrollTrigger.Vars,
    });

    if (introEye) tl.from(introEye, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0);
    if (introTitle) tl.from(introTitle, { y: 60, opacity: 0, duration: 1.0, ease: "power3.out" }, 0.1);
    if (num) tl.from(num, { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" }, 0);
    if (title) tl.from(title, { y: 50, opacity: 0, duration: 0.9, ease: "power3.out" }, 0.05);
    if (desc) tl.from(desc, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.15);
    if (tags.length) tl.from(tags, { y: 12, opacity: 0, stagger: 0.06, duration: 0.5, ease: "power3.out" }, 0.3);
    if (endOrb) tl.from(endOrb, { scale: 0, rotation: -180, duration: 1.4, ease: "expo.out" }, 0);
    if (endRings.length) tl.from(endRings, { scale: 0, opacity: 0, stagger: 0.12, duration: 1.0, ease: "expo.out" }, 0.15);
    if (endCore) tl.from(endCore, { scale: 0, duration: 0.8, ease: "back.out(4)" }, 0.5);
    if (endGlow) tl.from(endGlow, { scale: 0, opacity: 0, duration: 1.2, ease: "power2.out" }, 0.4);
  });
}
