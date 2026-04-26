import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { closingWords } from "../data/content";

export function animateClosing(closingWordsRefs: HTMLSpanElement[]) {
  const noteChars = "▪▫▬▮░▒";
  const makeNoise = (len: number) => {
    let s = "";
    for (let j = 0; j < len; j++) s += noteChars[Math.floor(Math.random() * noteChars.length)];
    return s;
  };

  const total = closingWordsRefs.length;
  const noiseMap: string[] = [];

  closingWordsRefs.forEach((wordEl, i) => {
    if (!wordEl) return;
    const realText = closingWords[i]!;
    const frozenNoise = makeNoise(realText.length);
    noiseMap[i] = frozenNoise;
    wordEl.textContent = frozenNoise + " ";
  });

  // Use the section as the trigger so all words resolve within its scroll range
  const section = closingWordsRefs[0]?.closest(".closing");
  if (!section) return;

  ScrollTrigger.create({
    trigger: section,
    start: "top 75%",
    end: "bottom 60%",
    scrub: 0.5,
    onUpdate: (self) => {
      const p = self.progress;
      closingWordsRefs.forEach((wordEl, i) => {
        if (!wordEl) return;
        const realText = closingWords[i]!;
        const frozenNoise = noiseMap[i]!;

        // Each word gets its own slice of the overall progress
        const wordStart = i / total;
        const wordEnd = (i + 1) / total;
        const wordProgress = Math.min(1, Math.max(0, (p - wordStart) / (wordEnd - wordStart)));

        const resolved = Math.floor(wordProgress * realText.length);
        wordEl.textContent = realText.slice(0, resolved) + frozenNoise.slice(resolved) + " ";
        wordEl.style.opacity = String(0.08 + wordProgress * 0.92);
      });
    },
  });
}
