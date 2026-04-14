import { type Component, createSignal, onMount, For } from "solid-js";
import { gsap } from "gsap";
import "./login.scss";

const Login: Component<{ onBack: () => void; onSignup?: () => void }> = (props) => {
  let pageRef!: HTMLDivElement;

  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");

  onMount(() => {
    const m = gsap.timeline();

    // Page in
    m.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });

    // Big script word
    m.fromTo(".login__script",
      { opacity: 0, y: 60, filter: "blur(12px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "expo.out" },
      0.2
    );

    // Display chars
    m.fromTo(".login__display-char",
      { y: "130%", opacity: 0, rotateZ: 6 },
      { y: "0%", opacity: 1, rotateZ: 0, duration: 1, stagger: 0.03, ease: "expo.out" },
      0.3
    );

    // Form fields slide up
    m.fromTo(".login__field",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "expo.out" },
      0.6
    );

    // Options row + footer
    m.fromTo(".login__row",
      { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.85);
    m.fromTo(".login__form-footer",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
      0.9
    );
    m.fromTo(".login__divider, .login__socials, .login__signup-text",
      { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.08 }, 1.0);

    // Back + meta
    m.fromTo(".login__back", { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.3);
    m.fromTo(".login__meta", { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.35);
  });

  return (
    <div ref={pageRef!} class="login">
      {/* Top bar */}
      <button class="login__back" onClick={props.onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 12H5M5 12L11 6M5 12L11 18" />
        </svg>
        <span>Back</span>
      </button>

      <div class="login__meta">
        <span>Authenticate</span>
        <span class="login__meta-sep">/</span>
        <span>2026</span>
      </div>

      {/* ── Center stage ── */}
      <div class="login__stage">
        {/* Typography */}
        <div class="login__hero">
          <div class="login__title-row">
            <span class="login__script">Welcome</span>
          </div>
          <div class="login__title-row">
            <div class="login__display-clip">
              <For each={"Back".split("")}>{(ch) =>
                <span class="login__display-char">{ch}</span>
              }</For>
            </div>
          </div>
        </div>

        {/* Form */}
        <form class="login__form" onSubmit={(e) => e.preventDefault()}>
          <div class="login__field login__field--first">
            <span class="login__field-num">01</span>
            <input
              class="login__input"
              type="email"
              placeholder="Email address"
              autocomplete="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
            <div class="login__line" />
          </div>

          <div class="login__field">
            <span class="login__field-num">02</span>
            <input
              class="login__input"
              type="password"
              placeholder="Password"
              autocomplete="current-password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <div class="login__line" />
          </div>

          <div class="login__row">
            <label class="login__remember">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <a class="login__forgot" href="#">Forgot password?</a>
          </div>

          <div class="login__form-footer">
            <button type="submit" class="login__submit">
              <span>Sign In</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </button>

            <p class="login__signup-text">
              No account?{" "}
              <button type="button" class="login__signup-link" onClick={props.onSignup}>Create one</button>
            </p>
          </div>

          <div class="login__divider">
            <div class="login__divider-line" />
            <span>or</span>
            <div class="login__divider-line" />
          </div>

          <div class="login__socials">
            <button type="button" class="login__social">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              <span>Google</span>
            </button>
            <button type="button" class="login__social">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              <span>GitHub</span>
            </button>
            <button type="button" class="login__social">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span>X</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
