import { type Component, createSignal, onMount, For } from "solid-js";
import { gsap } from "gsap";
import "./forgot-password.scss";

const ForgotPassword: Component<{ onBack: () => void; onLogin: () => void }> = (props) => {
  let pageRef!: HTMLDivElement;

  const [email, setEmail] = createSignal("");
  const [sent, setSent] = createSignal(false);

  onMount(() => {
    const m = gsap.timeline();

    m.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });

    m.fromTo(".forgot__script",
      { opacity: 0, y: 60, filter: "blur(12px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out" },
      0.2
    );

    m.fromTo(".forgot__display-char",
      { y: "130%", opacity: 0, rotateZ: 6 },
      { y: "0%", opacity: 1, rotateZ: 0, duration: 1, stagger: 0.03, ease: "expo.out" },
      0.3
    );

    m.fromTo(".forgot__subtitle",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" },
      0.6
    );

    m.fromTo(".forgot__field",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" },
      0.7
    );

    m.fromTo(".forgot__form-footer",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
      0.9
    );

    m.fromTo(".forgot__back", { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.3);
    m.fromTo(".forgot__meta", { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.35);
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!email()) return;
    setSent(true);

    gsap.timeline()
      .to(".forgot__form", { opacity: 0, y: -20, duration: 0.4, ease: "power2.in" })
      .fromTo(".forgot__success",
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", display: "flex" },
        0.3
      );
  };

  return (
    <div ref={pageRef!} class="forgot">
      <button class="forgot__back" onClick={props.onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 12H5M5 12L11 6M5 12L11 18" />
        </svg>
        <span>Back</span>
      </button>

      <div class="forgot__meta">
        <span>Recovery</span>
        <span class="forgot__meta-sep">/</span>
        <span>Reset</span>
      </div>

      <div class="forgot__stage">
        <div class="forgot__hero">
          <div class="forgot__title-row">
            <span class="forgot__script">Don't</span>
          </div>
          <div class="forgot__title-row">
            <div class="forgot__display-clip">
              <For each={"Worry".split("")}>{(ch) =>
                <span class="forgot__display-char">{ch}</span>
              }</For>
            </div>
          </div>
        </div>

        <p class="forgot__subtitle">
          Enter your email and we'll send you a link to reset your password.
        </p>

        <form class="forgot__form" onSubmit={handleSubmit}>
          <div class="forgot__field forgot__field--first">
            <span class="forgot__field-num">01</span>
            <input
              class="forgot__input"
              type="email"
              placeholder="Email address"
              autocomplete="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
            <div class="forgot__line" />
          </div>

          <div class="forgot__form-footer">
            <button type="submit" class="forgot__submit">
              <span>Send Reset Link</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </button>

            <p class="forgot__login-text">
              Remember your password?{" "}
              <button type="button" class="forgot__login-link" onClick={props.onLogin}>Sign In</button>
            </p>
          </div>
        </form>

        {/* Success state */}
        <div class="forgot__success">
          <div class="forgot__success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h3 class="forgot__success-title">Check your inbox</h3>
          <p class="forgot__success-text">
            We've sent a reset link to <strong>{email()}</strong>
          </p>
          <button type="button" class="forgot__submit" onClick={props.onLogin}>
            <span>Back to Sign In</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
