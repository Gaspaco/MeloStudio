import { gsap } from "gsap";
import { closingWords } from "../data/content";

export function animateClosing(closingWordsRefs: HTMLSpanElement[]) {
  const noteChars = "▪▫▬▮░▒";
  const makeNoise = (len: number) => {
    let s = "";
    for (let j = 0; j < len; j++) s += noteChars[Math.floor(Math.random() * noteChars.length)];
    return s;
  };

  closingWordsRefs.forEach((wordEl, i) => {
    if (!wordEl) return;
    const realText = closingWords[i]!;
    const frozenNoise = makeNoise(realText.length);
    wordEl.textContent = frozenNoise + " ";

    gsap.to(wordEl, {
      scrollTrigger: {
        trigger: wordEl,
        start: "top 88%",
        end: "top 55%",
        scrub: 0.5,
        onUpdate: (self) => {
          const p = self.progress;
          const resolved = Math.floor(p * realText.length);
          wordEl.textContent = realText.slice(0, resolved) + frozenNoise.slice(resolved) + " ";
        },
      },
      opacity: 1,
      ease: "none",
    });
  });
}
