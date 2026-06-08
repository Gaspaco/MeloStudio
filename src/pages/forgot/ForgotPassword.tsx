import { type Component, createSignal, onMount, For } from "solid-js";
import { gsap } from "gsap";
import { socialAuthClient } from "../../lib/social-auth";
import "./forgot-password.scss";

const ForgotPassword: Component<{ onBack: () => void; onLogin: () => void }> = (props) => {
  let pageRef: HTMLDivElement | undefined;

  const [email, setEmail] = createSignal("");
  const [sent, setSent] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  onMount(() => {
    if (!pageRef) return;
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

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!email() || isSubmitting()) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const check = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email() }),
      });
      const { exists } = await check.json() as { exists: boolean };
      if (!exists) {
        setErrorMsg("No account found with that email address.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await socialAuthClient.requestPasswordReset({
        email: email(),
        redirectTo: "/reset-password",
      });

      if (error) {
        setErrorMsg(error.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
      gsap.set(".forgot__success", { display: "flex", autoAlpha: 0, y: 50 });
      gsap.timeline()
        .to(".forgot__hero", { autoAlpha: 0, y: -30, duration: 0.5, ease: "power3.in" })
        .to(".forgot__subtitle", { autoAlpha: 0, y: -20, duration: 0.35, ease: "power2.in" }, "<0.05")
        .to(".forgot__form", { autoAlpha: 0, y: -20, duration: 0.35, ease: "power2.in" }, "<0.05")
        .to(".forgot__success", { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out" }, "-=0.1");
    } catch {
      setErrorMsg("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={(el) => { pageRef = el; }} class="forgot">
      <button class="forgot__back" onClick={props.onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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

          {errorMsg() && (
            <p class="forgot__error">{errorMsg()}</p>
          )}

          <div class="forgot__form-footer">
            <button type="submit" class="forgot__submit" disabled={isSubmitting()}>
              <span>{isSubmitting() ? "Sending..." : "Send Reset Link"}</span>
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
          <div class="forgot__success-hero">
            <div class="forgot__title-row">
              <span class="forgot__success-script">Check</span>
            </div>
            <div class="forgot__title-row">
              <div class="forgot__display-clip">
                <For each={"Inbox".split("")}>{(ch) =>
                  <span class="forgot__success-char">{ch}</span>
                }</For>
              </div>
            </div>
          </div>
          <p class="forgot__success-text">
            Link sent to <strong>{email()}</strong><br />
            Expires in 1 hour — check your spam if it doesn't show up.
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
