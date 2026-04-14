import { type Component, createSignal, onMount, onCleanup, For } from "solid-js";
import { gsap } from "gsap";
import "./signup.scss";

const Signup: Component<{ onBack: () => void; onLogin: () => void }> = (props) => {
  let pageRef!: HTMLDivElement;
  let heroRef!: HTMLDivElement;
  let scriptRef1!: HTMLSpanElement;
  let scriptRef2!: HTMLSpanElement;

  let formRef!: HTMLDivElement;

  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");

  onMount(() => {
    const m = gsap.timeline();

    // Page fade
    m.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.35 });

    // Big text
    m.fromTo(scriptRef1,
      { opacity: 0, y: 60, filter: "blur(12px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out" },
      0.2
    );
    m.fromTo(".signup__display-char",
      { y: "130%", opacity: 0, rotateZ: 6 },
      { y: "0%", opacity: 1, rotateZ: 0, duration: 1, stagger: 0.03, ease: "expo.out" },
      0.3
    );
    m.fromTo(scriptRef2,
      { opacity: 0, y: 60, filter: "blur(12px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out" },
      0.45
    );

    // Back + meta
    m.fromTo(".signup__back", { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.3);
    m.fromTo(".signup__meta", { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.35);

    // ── Form reveal on scroll ──
    let formRevealed = false;
    const revealForm = () => {
      if (formRevealed) return;
      const rect = formRef.getBoundingClientRect();
      const trigger = window.innerHeight * 0.75;
      if (rect.top < trigger) {
        formRevealed = true;
        const tl = gsap.timeline();
        tl.fromTo(formRef.querySelectorAll(".signup__form-title-line, .signup__form-title-script"),
          { opacity: 0, y: 60, clipPath: "inset(100% 0 0 0)" },
          { opacity: 1, y: 0, clipPath: "inset(0% 0 0 0)", duration: 0.9, stagger: 0.1, ease: "expo.out" });
        tl.fromTo(formRef.querySelectorAll(".signup__field"),
          { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" }, 0.4);
        tl.fromTo(formRef.querySelector(".signup__form-footer")!,
          { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.7);
      }
    };
    pageRef.addEventListener("scroll", revealForm, { passive: true });
    onCleanup(() => {
      pageRef.removeEventListener("scroll", revealForm);
    });
  });

  return (
    <div ref={pageRef!} class="signup">
      {/* Top bar */}
      <button class="signup__back" onClick={props.onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 12H5M5 12L11 6M5 12L11 18" />
        </svg>
        <span>Back</span>
      </button>

      <div class="signup__meta">
        <span>New Account</span>
        <span class="signup__meta-sep">/</span>
        <span>Step 01</span>
      </div>

      {/* ── Fixed hero text — visible first, goes behind images ── */}
      <div ref={heroRef!} class="signup__hero-text">
        <div class="signup__title-row">
          <span ref={scriptRef1!} class="signup__script">Begin</span>
          <div class="signup__display-clip">
            <For each={"Your".split("")}>{(ch) =>
              <span class="signup__display-char">{ch}</span>
            }</For>
          </div>
        </div>
        <div class="signup__title-row signup__title-row--2">
          <div class="signup__display-clip">
            <For each={"Journey".split("")}>{(ch) =>
              <span class="signup__display-char signup__display-char--stroke">{ch}</span>
            }</For>
          </div>
          <span ref={scriptRef2!} class="signup__script signup__script--accent">today</span>
        </div>
      </div>

      {/* ── Form section ── */}
      <div ref={formRef!} class="signup__form-section">
        <div class="signup__form-top">
          <h2 class="signup__form-title">
            <div class="signup__form-title-line">LET’S</div>
            <div class="signup__form-title-script">GET</div>
            <div class="signup__form-title-line">STARTED</div>
          </h2>
        </div>

        <form class="signup__form" onSubmit={(e) => e.preventDefault()}>
          <div class="signup__field signup__field--first">
            <span class="signup__field-num">01</span>
            <input
              type="text"
              id="signup-name"
              class="signup__input"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Your full name"
              autocomplete="name"
            />
            <div class="signup__line" />
          </div>

          <div class="signup__field">
            <span class="signup__field-num">02</span>
            <input
              type="email"
              id="signup-email"
              class="signup__input"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="Email address"
              autocomplete="email"
            />
            <div class="signup__line" />
          </div>

          <div class="signup__field">
            <span class="signup__field-num">03</span>
            <input
              type="password"
              id="signup-pass"
              class="signup__input"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Create a password"
              autocomplete="new-password"
            />
            <div class="signup__line" />
          </div>

          <div class="signup__form-footer">
            <button type="submit" class="signup__submit">
              <span>Create Account</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </button>

            <p class="signup__signin">
              Already have an account?
              <button type="button" class="signup__signin-link" onClick={props.onLogin}>Sign In</button>
            </p>
          </div>
        </form>
      </div>

    </div>
  );
};

export default Signup;
