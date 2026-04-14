import { type Component, createSignal, onMount, onCleanup, For } from "solid-js";
import { gsap } from "gsap";
import "./signup.scss";

const covers = [
  "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/37/da/7c/37da7cc5-2b6f-9bb8-30ba-8a8c3be3e16a/00602527584973.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/cc/0f/2d/cc0f2d02-5ff1-10e7-eea2-76863a55dbad/887828031795.png/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/59/10/66/591066ea-3c85-3dfe-ef82-ffdbbcdfc8b9/12UMGIM00033.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e9/c5/a8/e9c5a8a0-d698-137b-2e85-cf3a8d9548f8/190295303372.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e6/9c/2f/e69c2f37-db93-bf74-2429-569d408c51da/881034912541.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/c9/3c/0f/c93c0fe8-8d59-6f74-8004-c77b362684c2/artwork.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/c5/bb/ae/c5bbae2c-68ce-4efe-e0fa-2ee8769e46f3/09UMGIM33418.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/6c/13/27/6c13279a-399b-2631-3cb2-6233a91d7a53/19UMGIM78325.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/68/f9/fe/68f9fec8-81b6-38b1-7e27-796c431436fa/814908025306.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music127/v4/18/c3/66/18c366de-bf95-7ab6-e071-8117dba92f2c/886446526621.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/ea/64/81/ea6481e7-3785-651e-dfae-ba08f129391d/106b6b2d-5f41-4bdb-accc-23e0e818a62d.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/2b/b9/fe/2bb9fef5-d7f3-8345-25a9-db0e79fde4e4/20UMGIM11048.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/e3/e7/65e3e740-b69f-f5cb-f2e6-7dedb5265ac9/19UMGIM96748.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/89/4a/4a/894a4ab9-b0b0-9ea5-ca41-8da0b9b79453/14UMDIM03405.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/a2/bc/ad/a2bcad46-b389-4be1-8bac-5a0959b0b8e4/886446548449.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/9a/50/a1/9a50a1d8-01c2-2504-8d99-3f2fc7e5c2ff/12UMGIM52988.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ab/16/ef/ab16efe9-e7f1-66ec-021c-5592a23f0f9e/17UMGIM88793.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/6d/fb/f1/6dfbf17d-4032-f585-35ad-f3f9b6859cd9/886445460421.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/d2/53/62/d2536245-b94c-b3fd-7168-9512f655f6d4/00602527899091.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/39/25/2d/39252d65-2d50-b991-0962-f7a98a761271/00602517483507.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/60/e8/d1/60e8d144-2b8e-cbdc-9ff8-beaf9f4868b1/00602537542345.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ee/28/67/ee286794-6c33-a8c2-5c37-c04f1cb5e8a6/21UM1IM54415.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/2c/40/60/2c406032-1c81-9ccf-8ef0-93ea6af80b4a/4050538185096.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/95/f5/87/95f587f7-21c3-d5f9-d81a-4350f9caa020/16UMGIM27643.rgb.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4a/d7/df/4ad7df3d-f63c-45ed-e6be-6a808e5101b6/075679884763.jpg/600x600bb.jpg",
  "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/07/2b/a4/072ba4fa-7f4c-f478-6f22-13f9e62ac1be/21UMGIM53733.rgb.jpg/600x600bb.jpg"
];

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

    // Grid images reveal — staggered scale up
    m.fromTo(".signup__img",
      { scale: 1.15, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1.2, stagger: { each: 0.06, from: "random" }, ease: "expo.out" },
      0.05
    );

    // Big text behind
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

    // ── Scroll parallax — images rise at different speeds ──
    const imgs = pageRef.querySelectorAll(".signup__img");
    const speeds = [
      -0.08, -0.12, -0.06, -0.1, -0.14, -0.09,
      -0.07, -0.11, -0.13, -0.08, -0.1, -0.06,
      -0.12, -0.09, -0.07, -0.11,
    ];

    const mosaic = pageRef.querySelector(".signup__mosaic") as HTMLElement;

    let formRevealed = false;

    const onScroll = () => {
      const scrollY = pageRef.scrollTop;
      imgs.forEach((img, i) => {
        const speed = speeds[i % speeds.length] ?? -0.25;
        gsap.set(img, { y: scrollY * speed });
      });

      // Text clips from top — triggers after text fully clears past bottom images
      const mosaicBottom = mosaic.offsetTop + mosaic.offsetHeight;
      const viewBottom = scrollY + window.innerHeight;
      const buffer = window.innerHeight * 1.6;
      const pastImages = viewBottom - mosaicBottom - buffer;
      const slideZone = window.innerHeight * 0.8;
      
      if (pastImages > 0) {
        const progress = Math.min(1, pastImages / slideZone);
        gsap.to(heroRef, {
          clipPath: `inset(${progress * 100}% 0 0 0)`,
          duration: 0.6,
          ease: "power2.out",
          overwrite: true,
        });
      } else {
        gsap.to(heroRef, {
          clipPath: "inset(0% 0 0 0)",
          duration: 0.6,
          ease: "power2.out",
          overwrite: true,
        });
      }
    };

    pageRef.addEventListener("scroll", onScroll, { passive: true });

    // ── Form reveal on scroll (wait until they scroll down to the form) ──
    const revealForm = () => {
      if (formRevealed) return;
      const rect = formRef.getBoundingClientRect();
      const trigger = window.innerHeight * 1.0; // Trigger when form enters viewport
      if (rect.top < trigger) {
        formRevealed = true;
        const tl = gsap.timeline();
        // Parallel upward appearance
        tl.fromTo(
          formRef.querySelectorAll(".signup__form-title-line, .signup__form-title-script, .signup__field, .signup__form-footer"),
          { opacity: 0, y: 150 },
          { opacity: 1, y: 0, duration: 1.4, stagger: 0.05, ease: "power4.out", clipPath: "none" }
        );
      }
    };
    
    pageRef.addEventListener("scroll", revealForm, { passive: true });

    onCleanup(() => {
      pageRef.removeEventListener("scroll", onScroll);
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

      {/* ── Spacer so images begin just below the fold ── */}
      <div class="signup__hero-spacer" />

      {/* ── Bento mosaic ── */}
      <div class="signup__mosaic">
        <div class="signup__img signup__img--0" style={`background-image:url(${covers[0]})`} />
        <div class="signup__img signup__img--1" style={`background-image:url(${covers[1]})`} />
        <div class="signup__img signup__img--2" style={`background-image:url(${covers[2]})`} />
        <div class="signup__img signup__img--3" style={`background-image:url(${covers[3]})`} />
        <div class="signup__img signup__img--4" style={`background-image:url(${covers[4]})`} />
        <div class="signup__img signup__img--5" style={`background-image:url(${covers[5]})`} />
        <div class="signup__img signup__img--6" style={`background-image:url(${covers[6]})`} />
        <div class="signup__img signup__img--7" style={`background-image:url(${covers[7]})`} />
        <div class="signup__img signup__img--8" style={`background-image:url(${covers[8]})`} />
        <div class="signup__img signup__img--9" style={`background-image:url(${covers[9]})`} />
        <div class="signup__img signup__img--10" style={`background-image:url(${covers[10]})`} />
        <div class="signup__img signup__img--11" style={`background-image:url(${covers[11]})`} />
        <div class="signup__img signup__img--12" style={`background-image:url(${covers[12]})`} />
        <div class="signup__img signup__img--13" style={`background-image:url(${covers[13]})`} />
        <div class="signup__img signup__img--14" style={`background-image:url(${covers[14]})`} />
        <div class="signup__img signup__img--15" style={`background-image:url(${covers[15]})`} />
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
