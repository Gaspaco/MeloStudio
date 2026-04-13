import { gsap } from "gsap";

export function setupOrb(orbRef: HTMLDivElement) {
  const rings = orbRef.querySelectorAll(".h-panel--end__ring") as NodeListOf<HTMLElement>;
  const core = orbRef.querySelector(".h-panel--end__core") as HTMLElement;
  const glow = orbRef.querySelector(".h-panel--end__glow") as HTMLElement;

  const handleOrbMove = (e: MouseEvent) => {
    const rect = orbRef.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);

    rings.forEach((ring, i) => {
      const intensity = 25 - i * 5;
      const baseX = [70, 50, 30][i]!;
      const baseY = [0, 40, -60][i]!;
      gsap.to(ring, {
        rotateX: -dy * intensity + baseX,
        rotateY: dx * intensity + baseY,
        duration: 0.6,
        ease: "power2.out",
        overwrite: "auto",
      });
    });

    gsap.to(glow, { x: dx * 30, y: dy * 30, scale: 1.4, duration: 0.6, ease: "power2.out", overwrite: "auto" });
    gsap.to(core, { x: dx * 8, y: dy * 8, duration: 0.4, ease: "power2.out", overwrite: "auto" });
  };

  const handleOrbLeave = () => {
    rings.forEach((ring) => {
      gsap.to(ring, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1, 0.4)", overwrite: "auto", clearProps: "rotateX,rotateY" });
    });
    gsap.to(glow, { x: 0, y: 0, scale: 1, duration: 1, ease: "elastic.out(1, 0.4)", overwrite: "auto" });
    gsap.to(core, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.4)", overwrite: "auto" });
  };

  const handleOrbClick = () => {
    gsap.to(core, {
      scale: 2.5, boxShadow: "0 0 50px 20px rgba(224,82,151,0.8)", duration: 0.15, ease: "power2.out",
      onComplete: () => { gsap.to(core, { scale: 1, boxShadow: "0 0 24px 8px rgba(224,82,151,0.5)", duration: 0.8, ease: "elastic.out(1, 0.3)" }); },
    });
    gsap.to(glow, {
      scale: 2, opacity: 1, duration: 0.15,
      onComplete: () => { gsap.to(glow, { scale: 1, opacity: 0.5, duration: 1, ease: "power2.out" }); },
    });
    rings.forEach((ring) => {
      gsap.to(ring, {
        scale: 1.15, duration: 0.15, ease: "power2.out",
        onComplete: () => { gsap.to(ring, { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.4)" }); },
      });
    });
  };

  orbRef.addEventListener("mousemove", handleOrbMove);
  orbRef.addEventListener("mouseleave", handleOrbLeave);
  orbRef.addEventListener("click", handleOrbClick);
}
