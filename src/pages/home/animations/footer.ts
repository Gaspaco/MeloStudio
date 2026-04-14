import { gsap } from "gsap";

export function animateFooter(footerRef: HTMLElement) {
  const footerInfo = footerRef.querySelector(".footer__info") as HTMLElement;
  const footerBrandLines = footerRef.querySelectorAll(".footer__brand-line");

  const footerTl = gsap.timeline({
    scrollTrigger: {
      trigger: footerRef,
      start: "top 85%",
      toggleActions: "restart none none reset",
    },
  });

  if (footerInfo) footerTl.from(footerInfo, { y: 20, opacity: 0, duration: 0.8, ease: "power3.out" }, 0);
  if (footerBrandLines.length) footerTl.from(footerBrandLines, { y: 120, stagger: 0.12, duration: 1.4, ease: "expo.out" }, 0.15);

  return footerTl;
}
