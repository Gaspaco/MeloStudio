import { type Component, createSignal, onMount, For } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { gsap } from "gsap";
import { socialAuthClient } from "../../lib/social-auth";
import "./reset-password.scss";

const ResetPassword: Component<{ onBack: () => void; onSuccess: () => void }> = (props) => {
  let pageRef: HTMLDivElement | undefined;
  const [searchParams] = useSearchParams();

  const [password, setPassword] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [done, setDone] = createSignal(false);

  onMount(() => {
    if (!pageRef) return;
    const m = gsap.timeline();
    m.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    m.fromTo(".rp__script",
      { opacity: 0, y: 60, filter: "blur(12px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out" }, 0.2);
    m.fromTo(".rp__display-char",
      { y: "130%", opacity: 0, rotateZ: 6 },
      { y: "0%", opacity: 1, rotateZ: 0, duration: 1, stagger: 0.03, ease: "expo.out" }, 0.3);
    m.fromTo(".rp__subtitle",
      { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, 0.6);
    m.fromTo(".rp__field",
      { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "expo.out" }, 0.7);
    m.fromTo(".rp__form-footer",
      { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.9);
    m.fromTo(".rp__back", { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.3);
    m.fromTo(".rp__meta", { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.35);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password().length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password() !== confirm()) {
      setErrorMsg("Passwords don't match.");
      return;
    }

    const token = searchParams.token as string | undefined;
    if (!token) {
      setErrorMsg("Invalid or expired reset link. Please request a new one.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await socialAuthClient.resetPassword({
        newPassword: password(),
        token,
      });

      if (error) {
        setErrorMsg(error.message ?? "Reset failed. The link may have expired.");
        return;
      }

      setDone(true);
      gsap.timeline()
        .to(".rp__form", { opacity: 0, y: -20, duration: 0.4, ease: "power2.in" })
        .fromTo(".rp__success",
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", display: "flex" }, 0.3);
    } catch {
      setErrorMsg("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={(el) => { pageRef = el; }} class="rp">
      <button class="rp__back" onClick={props.onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 12H5M5 12L11 6M5 12L11 18" />
        </svg>
        <span>Back</span>
      </button>

      <div class="rp__meta">
        <span>Recovery</span>
        <span class="rp__meta-sep">/</span>
        <span>New Password</span>
      </div>

      <div class="rp__stage">
        <div class="rp__hero">
          <div class="rp__title-row">
            <span class="rp__script">Almost</span>
          </div>
          <div class="rp__title-row">
            <div class="rp__display-clip">
              <For each={"There".split("")}>{(ch) =>
                <span class="rp__display-char">{ch}</span>
              }</For>
            </div>
          </div>
        </div>

        <p class="rp__subtitle">Choose a new password for your account.</p>

        <form class="rp__form" onSubmit={handleSubmit}>
          <div class="rp__field rp__field--first">
            <span class="rp__field-num">01</span>
            <input
              class="rp__input"
              type="password"
              placeholder="New password"
              autocomplete="new-password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <div class="rp__line" />
          </div>

          <div class="rp__field">
            <span class="rp__field-num">02</span>
            <input
              class="rp__input"
              type="password"
              placeholder="Confirm password"
              autocomplete="new-password"
              value={confirm()}
              onInput={(e) => setConfirm(e.currentTarget.value)}
            />
            <div class="rp__line" />
          </div>

          {errorMsg() && <p class="rp__error">{errorMsg()}</p>}

          <div class="rp__form-footer">
            <button type="submit" class="rp__submit" disabled={isSubmitting()}>
              <span>{isSubmitting() ? "Saving..." : "Set New Password"}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </button>
          </div>
        </form>

        <div class="rp__success">
          <div class="rp__success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h3 class="rp__success-title">Password updated</h3>
          <p class="rp__success-text">You can now sign in with your new password.</p>
          <button type="button" class="rp__submit" onClick={props.onSuccess}>
            <span>Sign In</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
