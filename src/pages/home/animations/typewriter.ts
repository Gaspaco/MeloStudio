import { type Setter } from "solid-js";
import { typewriterWords } from "../data/content";

export function startTypewriter(
  setTwText: Setter<string>,
  setTwCursor: Setter<boolean>,
): () => void {
  let wordIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let twTimer: ReturnType<typeof setTimeout> | undefined;

  const type = () => {
    const word = typewriterWords[wordIdx]!;
    if (!isDeleting) {
      charIdx++;
      setTwText(word.slice(0, charIdx));
      if (charIdx === word.length) {
        isDeleting = true;
        twTimer = setTimeout(type, 1800);
        return;
      }
    } else {
      charIdx--;
      setTwText(word.slice(0, charIdx));
      if (charIdx === 0) {
        isDeleting = false;
        wordIdx = (wordIdx + 1) % typewriterWords.length;
        twTimer = setTimeout(type, 300);
        return;
      }
    }
    twTimer = setTimeout(type, isDeleting ? 55 : 85);
  };

  const cursorTimer = setInterval(() => setTwCursor((c) => !c), 530);
  twTimer = setTimeout(type, 800);

  return () => {
    if (twTimer) clearTimeout(twTimer);
    clearInterval(cursorTimer);
  };
}
