import { type Component, For, Show } from "solid-js";
import { closingWords, closingAccentWords, closingWordImages } from "../data/content";

const Closing: Component<{
  closingWordsRefs: HTMLSpanElement[];
}> = (props) => {
  return (
    <section class="closing">
      <p class="closing__text">
        <For each={closingWords}>{(word, i) =>
          <>
            <Show when={closingWordImages[word]}>
              <span class="closing__inline-img">
                <img src={closingWordImages[word]} alt="" loading="lazy" />
              </span>
            </Show>
            <span
              ref={(el: HTMLSpanElement) => (props.closingWordsRefs[i()] = el)}
              class={`closing__word${closingAccentWords.has(word) ? " closing__word--accent" : ""}`}
            >
              {word}{" "}
            </span>
          </>
        }</For>
      </p>
    </section>
  );
};

export default Closing;
