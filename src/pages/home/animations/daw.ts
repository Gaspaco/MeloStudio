import { gsap } from "gsap";

export function animateDaw(refs: {
  dawWrapRef: HTMLDivElement;
  reelRef: HTMLElement;
}) {
  gsap.fromTo(
    refs.dawWrapRef,
    { scale: 0.12, opacity: 0, borderRadius: "24px" },
    {
      scale: 1,
      opacity: 1,
      borderRadius: "0px",
      ease: "none",
      scrollTrigger: {
        trigger: refs.reelRef,
        start: "top top",
        end: "+=200%",
        pin: true,
        scrub: 0.8,
      },
    }
  );

  const playhead = refs.dawWrapRef.querySelector(".daw__playhead") as HTMLElement;
  const allBlocks = refs.dawWrapRef.querySelectorAll(".daw__block") as NodeListOf<HTMLElement>;

  if (playhead && allBlocks.length) {
    const timeline = refs.dawWrapRef.querySelector(".daw__timeline") as HTMLElement;

    gsap.fromTo(
      playhead,
      { left: "0%" },
      {
        left: "100%",
        duration: 20,
        repeat: -1,
        ease: "none",
        delay: 3,
        onUpdate() {
          if (!timeline) return;
          const timelineRect = timeline.getBoundingClientRect();
          const playheadX = playhead.getBoundingClientRect().left - timelineRect.left;
          const timelineW = timelineRect.width;
          const playheadPct = (playheadX / timelineW) * 100;

          allBlocks.forEach((block) => {
            const blockLeft = parseFloat(block.style.left);
            const blockWidth = parseFloat(block.style.width);
            const blockRight = blockLeft + blockWidth;

            if (playheadPct >= blockLeft && playheadPct <= blockRight) {
              block.classList.add("daw__block--active");
            } else {
              block.classList.remove("daw__block--active");
            }
          });
        },
      }
    );
  }
}
