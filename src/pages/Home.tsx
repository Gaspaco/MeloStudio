import { type Component, createSignal, onMount, onCleanup } from "solid-js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import styles from "./Home.module.scss";

gsap.registerPlugin(ScrollTrigger);

const Home: Component = () => {
  let lenisRef: InstanceType<typeof Lenis> | undefined;
  let loaderRef!: HTMLDivElement;
  let loaderMeloRef!: HTMLDivElement;
  let loaderStudioRef!: HTMLDivElement;
  let heroRef!: HTMLElement;
  let heroTitleRef!: HTMLDivElement;
  let heroLine1Ref!: HTMLDivElement;
  let heroLine2Ref!: HTMLDivElement;
  let heroMetaRef!: HTMLDivElement;
  let scrollIndRef!: HTMLDivElement;
  let reelRef!: HTMLElement;
  let dawWrapRef!: HTMLDivElement;

  let manifestoRef!: HTMLElement;
  let manifestoTextRef!: HTMLDivElement;
  let hScrollRef!: HTMLElement;
  let hScrollTrackRef!: HTMLDivElement;
  let closingWordsRefs: HTMLSpanElement[] = [];
  let footerRef!: HTMLElement;
  let orbRef!: HTMLDivElement;
  let slabRef!: HTMLDivElement;
  let slabGlowRef!: HTMLDivElement;
  let cubeRef!: HTMLDivElement;

  const tracks = [
    { label: "Lead Vox", color: "#ccff00", vol: 82, blocks: [{ x: 8, w: 22 }, { x: 34, w: 18 }, { x: 58, w: 26 }] },
    { label: "Backing", color: "#aadd00", vol: 65, blocks: [{ x: 14, w: 38 }, { x: 56, w: 30 }] },
    { label: "Pad", color: "#00f0ff", vol: 48, blocks: [{ x: 0, w: 42 }, { x: 48, w: 40 }] },
    { label: "Keys", color: "#00b3ff", vol: 70, blocks: [{ x: 6, w: 16 }, { x: 26, w: 32 }, { x: 62, w: 24 }] },
    { label: "808", color: "#ff0055", vol: 90, blocks: [{ x: 0, w: 12 }, { x: 16, w: 12 }, { x: 32, w: 12 }, { x: 48, w: 12 }, { x: 64, w: 12 }] },
    { label: "Clap", color: "#ff00a0", vol: 55, blocks: [{ x: 5, w: 5 }, { x: 15, w: 5 }, { x: 25, w: 5 }, { x: 35, w: 5 }, { x: 45, w: 5 }, { x: 55, w: 5 }, { x: 65, w: 5 }] },
    { label: "Hi-Hat", color: "#ffffff", vol: 40, blocks: [{ x: 0, w: 3 }, { x: 5, w: 3 }, { x: 10, w: 3 }, { x: 15, w: 3 }, { x: 20, w: 3 }, { x: 25, w: 3 }, { x: 30, w: 3 }, { x: 35, w: 3 }, { x: 40, w: 3 }, { x: 45, w: 3 }, { x: 50, w: 3 }, { x: 55, w: 3 }, { x: 60, w: 3 }, { x: 65, w: 3 }, { x: 70, w: 3 }] },
    { label: "Sub Bass", color: "#8c00ff", vol: 88, blocks: [{ x: 0, w: 30 }, { x: 34, w: 28 }, { x: 66, w: 22 }] },
    { label: "FX Riser", color: "#555555", vol: 35, blocks: [{ x: 20, w: 28 }, { x: 60, w: 20 }] },
    { label: "Perc", color: "#888888", vol: 45, blocks: [{ x: 2, w: 4 }, { x: 8, w: 4 }, { x: 14, w: 4 }, { x: 22, w: 4 }, { x: 30, w: 4 }, { x: 38, w: 4 }, { x: 46, w: 4 }, { x: 54, w: 4 }, { x: 62, w: 4 }, { x: 70, w: 4 }] },
  ];

  const closingWordImages: Record<string, string> = {
    "audio": "https://cdn-images.dzcdn.net/images/cover/b5d7b0054e47ae579716bc251c4b08ae/500x500-000000-80-0-0.jpg",
    "in": "https://cdn-images.dzcdn.net/images/cover/aa7e6de00b0810f5051aa60b489f58d8/500x500-000000-80-0-0.jpg",
    "browser.": "https://cdn-images.dzcdn.net/images/cover/7ce6b8452fae425557067db6e6a1cad5/500x500-000000-80-0-0.jpg",
    "create.": "https://cdn-images.dzcdn.net/images/cover/7df7ac6028591a5622f24cf32a555510/500x500-000000-80-0-0.jpg",
  };
  const closingAccentWords = new Set(["Desktop-grade", "browser.", "create.", "No"]);
  const closingWords = "Desktop-grade audio production belongs in the browser. No installs. No compromises. Just create.".split(" ");
  const typewriterWords = ["conceptualise.", "produce.", "create.", "master.", "perform."];
  const [twText, setTwText] = createSignal("");
  const [twCursor, setTwCursor] = createSignal(true);
  const [menuOpen, setMenuOpen] = createSignal(false);

  const capabilities = [
    {
      num: "01",
      title: "Timeline",
      titleBold: "line",
      titleScript: "Time",
      desc: "Multi-track sequencing with snap-to-grid precision. Drag, trim, loop — non-destructive editing that respects your flow.",
      stats: ["Unlimited tracks", "Crossfade", "BPM sync"],
      accent: "#ccff00",
    },
    {
      num: "02",
      title: "WASM Engine",
      titleBold: "Engine",
      titleScript: "WASM",
      desc: "C++ audio DSP compiled to WebAssembly. Sub-3ms latency, zero crackle. Desktop-grade processing, zero installs.",
      stats: ["64-bit float", "SIMD", "Offline render"],
      accent: "#00f0ff",
    },
    {
      num: "03",
      title: "Mixer",
      titleBold: "er",
      titleScript: "Mix",
      desc: "Full effects chain per channel. EQ, compressor, reverb — VST-class processing inside your browser tab.",
      stats: ["Sidechain", "Automation", "Bus routing"],
      accent: "#ff0055",
    },
    {
      num: "04",
      title: "Cloud Sync",
      titleBold: "Sync",
      titleScript: "Cloud",
      desc: "Every session persisted in real-time. Pick up where you left off, on any device, anywhere in the world.",
      stats: ["Version history", "Real-time collab", "WAV / MP3"],
      accent: "#8c00ff",
    },
  ];

  onMount(() => {
    // ── Lenis ──
    lenisRef = new Lenis({
      duration: 0.9,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenisRef!.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // ── Intro sequence ──
    const hasLoaded = sessionStorage.getItem("melostudio_loaded");

    if (hasLoaded) {
      // Skip loader entirely
      gsap.set(loaderRef, { display: "none" });
    }

    const intro = gsap.timeline({ delay: hasLoaded ? 0 : 0.2 });

    if (!hasLoaded) {
      // MELO: each letter rises up
      const meloChars = loaderMeloRef.querySelectorAll("." + styles.loader__char);
      const studioChars = loaderStudioRef.querySelectorAll("." + styles.loader__char);
      intro
        .from(meloChars, {
          yPercent: 120,
          stagger: 0.08,
          duration: 0.7,
          ease: "power4.out",
        }, 0)
        // Studio: letters slide in from right, staggered
        .from(studioChars, {
          xPercent: 80,
          opacity: 0,
          stagger: 0.05,
          duration: 0.6,
          ease: "power3.out",
        }, 0.4)
        // Hold, then slide up
        .to(loaderRef, { yPercent: -100, duration: 0.8, ease: "power4.inOut" }, 1.4);

      sessionStorage.setItem("melostudio_loaded", "1");
    }

    intro
      // "Melo" — wipe-reveal from left + slight rise
      .fromTo(heroLine1Ref, {
        clipPath: "inset(0 100% 0 0)",
        x: -60,
        y: 20,
      }, {
        clipPath: "inset(0 0% 0 0)",
        x: 0,
        y: 0,
        duration: 1.3,
        ease: "power4.inOut",
      }, 0.9)
      // "Studio" — wipe-reveal from right + slight rise
      .fromTo(heroLine2Ref, {
        clipPath: "inset(0 0 0 100%)",
        x: 60,
        y: 20,
      }, {
        clipPath: "inset(0 0 0 0%)",
        x: 0,
        y: 0,
        duration: 1.3,
        ease: "power4.inOut",
      }, 1.1)
      // Meta
      .from(heroMetaRef!.children as any, {
        opacity: 0,
        y: 12,
        stagger: 0.06,
        duration: 0.5,
        ease: "power3.out",
      }, 1.9)
      .fromTo(scrollIndRef, { scaleY: 0 }, { scaleY: 1, duration: 0.8, transformOrigin: "top" }, 2.1);

    // ── Hero exit on scroll ── (wipe out to opposite sides)
    const heroExit = gsap.timeline({
      scrollTrigger: {
        trigger: heroRef,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
    heroExit
      .to(heroLine1Ref, { clipPath: "inset(0 0 0 100%)", x: 60, ease: "none" }, 0)
      .to(heroLine2Ref, { clipPath: "inset(0 100% 0 0)", x: -60, ease: "none" }, 0)
      .to(heroMetaRef, { opacity: 0, y: -20, ease: "none" }, 0)
      .to(scrollIndRef, { opacity: 0, ease: "none" }, 0);

    // ── DAW zoom-in (pinned) ──
    gsap.fromTo(
      dawWrapRef,
      { scale: 0.12, opacity: 0, borderRadius: "24px" },
      {
        scale: 1,
        opacity: 1,
        borderRadius: "0px",
        ease: "none",
        scrollTrigger: {
          trigger: reelRef,
          start: "top top",
          end: "+=200%",
          pin: true,
          scrub: 0.8,
        },
      }
    );

    // Playhead sweep + block lighting
    const playhead = dawWrapRef?.querySelector("." + styles.daw__playhead) as HTMLElement;
    const allBlocks = dawWrapRef?.querySelectorAll("." + styles.daw__block) as NodeListOf<HTMLElement>;

    if (playhead && allBlocks.length) {
      const timeline = dawWrapRef?.querySelector("." + styles.daw__timeline) as HTMLElement;

      gsap.fromTo(
        playhead,
        { left: "0%" },
        {
          left: "100%",
          duration: 20,
          repeat: -1,
          ease: "none",
          delay: 3,
          onUpdate: function () {
            if (!timeline) return;
            const timelineRect = timeline.getBoundingClientRect();
            const playheadX = playhead.getBoundingClientRect().left - timelineRect.left;
            const timelineW = timelineRect.width;
            const playheadPct = (playheadX / timelineW) * 100;

            allBlocks.forEach((block) => {
              const blockLeft = parseFloat(block.style.left);
              const blockWidth = parseFloat(block.style.width);
              const blockRight = blockLeft + blockWidth;

              if (playheadPct >= blockLeft && playheadPct <= blockRight) {
                block.classList.add(styles.daw__blockActive!);
              } else {
                block.classList.remove(styles.daw__blockActive!);
              }
            });
          },
        }
      );
    }

    // ── Manifesto typewriter ──
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

    onCleanup(() => {
      if (twTimer) clearTimeout(twTimer);
      clearInterval(cursorTimer);
    });

    // ── Horizontal scroll capabilities ──
    const panels = gsap.utils.toArray("." + styles.hPanel) as HTMLElement[];
    if (panels.length && hScrollTrackRef) {
      const totalWidth = hScrollTrackRef.scrollWidth;
      const scrollDistance = Math.max(1, totalWidth - window.innerWidth);

      const scrollTween = gsap.to(hScrollTrackRef, {
        x: -scrollDistance,
        ease: "none",
        scrollTrigger: {
          trigger: hScrollRef,
          start: "top top",
          end: () => `+=${scrollDistance}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      // Reveal each panel's content using containerAnimation
      panels.forEach((panel) => {
        const num = panel.querySelector("." + styles.hPanel__num) as HTMLElement;
        const title = panel.querySelector("." + styles.hPanel__title) as HTMLElement;
        const desc = panel.querySelector("." + styles.hPanel__desc) as HTMLElement;
        const tags = panel.querySelectorAll("." + styles.hPanel__tag);
        const introEye = panel.querySelector("." + styles.hPanel__introEye) as HTMLElement;
        const introTitle = panel.querySelector("." + styles.hPanel__introTitle) as HTMLElement;
        const endOrb = panel.querySelector("." + styles.hPanelEnd__orb) as HTMLElement;
        const endRings = panel.querySelectorAll("." + styles.hPanelEnd__ring);
        const endCore = panel.querySelector("." + styles.hPanelEnd__core) as HTMLElement;
        const endGlow = panel.querySelector("." + styles.hPanelEnd__glow) as HTMLElement;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            containerAnimation: scrollTween,
            start: "left 80%",
            toggleActions: "play none none reverse",
          } as ScrollTrigger.Vars,
        });

        // Intro panel
        if (introEye) tl.from(introEye, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0);
        if (introTitle) tl.from(introTitle, { y: 60, opacity: 0, duration: 1.0, ease: "power3.out" }, 0.1);

        // Capability panels
        if (num) tl.from(num, { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" }, 0);
        if (title) tl.from(title, { y: 50, opacity: 0, duration: 0.9, ease: "power3.out" }, 0.05);
        if (desc) tl.from(desc, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.15);
        if (tags.length) tl.from(tags, { y: 12, opacity: 0, stagger: 0.06, duration: 0.5, ease: "power3.out" }, 0.3);

        // End panel
        if (endOrb) tl.from(endOrb, { scale: 0, rotation: -180, duration: 1.4, ease: "expo.out" }, 0);
        if (endRings.length) tl.from(endRings, { scale: 0, opacity: 0, stagger: 0.12, duration: 1.0, ease: "expo.out" }, 0.15);
        if (endCore) tl.from(endCore, { scale: 0, duration: 0.8, ease: "back.out(4)" }, 0.5);
        if (endGlow) tl.from(endGlow, { scale: 0, opacity: 0, duration: 1.2, ease: "power2.out" }, 0.4);
      });
    }

    // ── Closing word-by-word music decode ──
    const noteChars = "▪▫▬▮░▒";
    const makeNoise = (len: number) => {
      let s = "";
      for (let j = 0; j < len; j++) s += noteChars[Math.floor(Math.random() * noteChars.length)];
      return s;
    };

    closingWordsRefs.forEach((wordEl, i) => {
      if (!wordEl) return;
      const realText = closingWords[i]!;
      // Pre-generate a fixed noise string so it doesn't flicker
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
            wordEl.textContent =
              realText.slice(0, resolved) +
              frozenNoise.slice(resolved) + " ";
          },
        },
        opacity: 1,
        ease: "none",
      });
    });

    // ── Footer ──
    const footerInfo = footerRef.querySelector("." + styles.footer__info) as HTMLElement;
    const footerBrandLines = footerRef.querySelectorAll("." + styles.footer__brandLine);

    const footerTl = gsap.timeline({
      scrollTrigger: {
        trigger: footerRef,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    if (footerInfo) footerTl.from(footerInfo, { y: 20, opacity: 0, duration: 0.8, ease: "power3.out" }, 0);
    if (footerBrandLines.length) footerTl.from(footerBrandLines, { y: 120, stagger: 0.12, duration: 1.4, ease: "expo.out" }, 0.15);

    // ── Orb interactivity ──
    const rings = orbRef.querySelectorAll("." + styles.hPanelEnd__ring) as NodeListOf<HTMLElement>;
    const core = orbRef.querySelector("." + styles.hPanelEnd__core) as HTMLElement;
    const glow = orbRef.querySelector("." + styles.hPanelEnd__glow) as HTMLElement;

    const handleOrbMove = (e: MouseEvent) => {
      const rect = orbRef.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);

      // Tilt rings toward cursor
      rings.forEach((ring, i) => {
        const intensity = 25 - i * 5;
        const baseX = [70, 50, 30][i]!;
        const baseY = [0, 40, -60][i]!;
        gsap.to(ring, {
          rotateX: -dy * intensity + baseX,
          rotateY: dx * intensity + baseY,
          duration: 0.6,
          ease: "power2.out",
          overwrite: "auto",
        });
      });

      // Shift glow toward cursor
      gsap.to(glow, {
        x: dx * 30,
        y: dy * 30,
        scale: 1.4,
        duration: 0.6,
        ease: "power2.out",
        overwrite: "auto",
      });

      // Shift core slightly
      gsap.to(core, {
        x: dx * 8,
        y: dy * 8,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    const handleOrbLeave = () => {
      // Reset rings to their CSS animation defaults
      rings.forEach((ring) => {
        gsap.to(ring, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1, 0.4)", overwrite: "auto", clearProps: "rotateX,rotateY" });
      });
      gsap.to(glow, { x: 0, y: 0, scale: 1, duration: 1, ease: "elastic.out(1, 0.4)", overwrite: "auto" });
      gsap.to(core, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.4)", overwrite: "auto" });
    };

    const handleOrbClick = () => {
      // Expand burst on click
      gsap.to(core, { scale: 2.5, boxShadow: "0 0 50px 20px rgba(224,82,151,0.8)", duration: 0.15, ease: "power2.out",
        onComplete: () => { gsap.to(core, { scale: 1, boxShadow: "0 0 24px 8px rgba(224,82,151,0.5)", duration: 0.8, ease: "elastic.out(1, 0.3)" }); }
      });
      gsap.to(glow, { scale: 2, opacity: 1, duration: 0.15,
        onComplete: () => { gsap.to(glow, { scale: 1, opacity: 0.5, duration: 1, ease: "power2.out" }); }
      });
      rings.forEach((ring) => {
        gsap.to(ring, { scale: 1.15, duration: 0.15, ease: "power2.out",
          onComplete: () => { gsap.to(ring, { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.4)" }); }
        });
      });
    };

    orbRef.addEventListener("mousemove", handleOrbMove);
    orbRef.addEventListener("mouseleave", handleOrbLeave);
    orbRef.addEventListener("click", handleOrbClick);
  });

  onCleanup(() => {
    lenisRef?.destroy();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  });

  return (
    <div class={styles.page}>
      {/* ── Loader ── */}
      <div ref={loaderRef!} class={styles.loader}>
        <div ref={loaderMeloRef!} class={styles.loader__melo}>
          {"MELO".split("").map((ch) => (
            <span class={styles.loader__char}>{ch}</span>
          ))}
        </div>
        <div ref={loaderStudioRef!} class={styles.loader__studio}>
          {"Studio".split("").map((ch) => (
            <span class={styles.loader__char}>{ch}</span>
          ))}
        </div>
      </div>

      {/* ── Grain ── */}
      <div class={styles.grain} aria-hidden="true" />

      {/* ── Nav ── */}
      <nav class={styles.nav}>
        <span class={styles.nav__logo}>
          <span class={styles.nav__logoMelo}>Melo</span><span class={styles.nav__logoStudio}>Studio</span>
        </span>

        {/* ── 3D Slab Widget ── */}
        <div
          ref={slabRef!}
          class={styles.slab}
          onClick={() => setMenuOpen(!menuOpen())}
          onMouseMove={(e) => {
            if (menuOpen()) return;
            const rect = slabRef.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            gsap.to(slabRef, {
              rotateY: x * 18,
              rotateX: y * -12,
              duration: 0.4,
              ease: "power2.out",
            });
            gsap.to(slabGlowRef, { opacity: 0.5, duration: 0.3 });
            gsap.to(cubeRef, {
              rotateY: x * 60,
              rotateX: y * -60,
              duration: 0.4,
              ease: "power2.out",
            });
          }}
          onMouseLeave={() => {
            gsap.to(slabRef, {
              rotateY: 0,
              rotateX: 0,
              duration: 0.6,
              ease: "elastic.out(1, 0.5)",
            });
            gsap.to(slabGlowRef, { opacity: 0, duration: 0.5 });
            gsap.to(cubeRef, {
              rotateY: 0,
              rotateX: 0,
              duration: 0.6,
              ease: "elastic.out(1, 0.5)",
            });
          }}
        >
          <div ref={slabGlowRef!} class={styles.slab__glow} />
          <div class={styles.slab__sheen} />
          <div ref={cubeRef!} class={styles.slab__cube}>
            {["front", "back", "left", "right", "top", "bottom"].map((face) => (
              <div class={styles.slab__cubeFace} data-face={face}>
                <div class={styles.slab__marquee}>
                  <span>Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span><span>Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;Menu&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Nav Menu Overlay ── */}
        <div class={`${styles.navMenu}${menuOpen() ? ` ${styles.navMenuOpen}` : ""}`}>
          <div class={styles.navMenu__bg} />
          <div class={styles.navMenu__close} onClick={() => setMenuOpen(false)}>
            <svg class={styles.navMenu__closeArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 12H5M5 12L11 6M5 12L11 18" /></svg>
          </div>
          <div class={styles.navMenu__left}>
            <span class={styles.navMenu__eyebrow}>Navigation</span>
            <span class={styles.navMenu__desc}>Explore the features that make MeloStudio the most powerful browser-native DAW.</span>
          </div>
          <div class={styles.navMenu__right}>
            {["Timeline", "Mixer", "Engine", "Cloud"].map((label, i) => (
              <a class={styles.navMenu__row} style={{ "--i": i } as any}>
                <span class={styles.navMenu__num}>{String(i + 1).padStart(2, "0")}</span>
                <span class={styles.navMenu__divider} />
                <span class={styles.navMenu__label}>
                  {label.split("").map((ch, ci) => (
                    <span class={styles.navMenu__char} style={{ "--ci": ci, "--i": i } as any}>{ch}</span>
                  ))}
                </span>
              </a>
            ))}
          </div>
          <div class={styles.navMenu__bottom}>
            <div class={styles.navMenu__socials}>
              <a class={styles.navMenu__socialLink} href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a class={styles.navMenu__socialLink} href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a class={styles.navMenu__socialLink} href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
              <a class={styles.navMenu__socialLink} href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div class={styles.navMenu__footer}>
              <span>© 2026 MeloStudio</span>
              <span>All rights reserved</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef!} class={styles.hero}>
        <div ref={heroTitleRef!} class={styles.hero__title}>
          <div class={styles.hero__clip}>
            <div ref={heroLine1Ref!} class={`${styles.hero__word} ${styles.hero__wordPink}`}>Melo</div>
          </div>
          <div class={styles.hero__clip}>
            <div ref={heroLine2Ref!} class={`${styles.hero__word} ${styles.hero__wordStroke}`}>Studio</div>
          </div>
        </div>
        <div ref={heroMetaRef!} class={styles.hero__meta}>
          <span>Browser-native DAW</span>
          <span class={styles.hero__sep}>/</span>
          <span>WASM Engine</span>
          <span class={styles.hero__sep}>/</span>
          <span>2026</span>
        </div>
        <div class={styles.hero__scroll}>
          <div ref={scrollIndRef!} class={styles.hero__scrollLine} />
        </div>
      </section>

      {/* ── Reel (DAW Preview) ── */}
      <section ref={reelRef!} class={styles.reel}>
        <div ref={dawWrapRef!} class={styles.reel__inner}>
          <div class={styles.daw}>
            {/* Toolbar */}
            <div class={styles.daw__toolbar}>
              <div class={styles.daw__tabs}>
                <span class={`${styles.daw__tab} ${styles.daw__tabActive}`}>Arrange</span>
                <span class={styles.daw__tab}>Mix</span>
                <span class={styles.daw__tab}>Master</span>
              </div>
              <div class={styles.daw__controls}>
                <div class={styles.daw__btnStop} />
                <div class={styles.daw__btnPlay} />
                <div class={styles.daw__btnRec} />
              </div>
              <div class={styles.daw__info}>
                <div class={styles.daw__pill}>128 <span>BPM</span></div>
                <div class={styles.daw__pill}>A min</div>
                <div class={styles.daw__pill}>4/4</div>
                <div class={styles.daw__time}>01:24.08</div>
              </div>
            </div>

            {/* Main area */}
            <div class={styles.daw__body}>
              {/* Sidebar */}
              <div class={styles.daw__sidebar}>
                {tracks.map((t) => (
                  <div class={styles.daw__label}>
                    <div class={styles.daw__strip} style={{ background: t.color }} />
                    <div class={styles.daw__labelInner}>
                      <span class={styles.daw__trackName}>{t.label}</span>
                      <div class={styles.daw__trackMeta}>
                        <span class={styles.daw__mute}>M</span>
                        <span class={styles.daw__solo}>S</span>
                        <div class={styles.daw__vol}>
                          <div class={styles.daw__volFill} style={{ width: `${t.vol}%`, background: t.color }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div class={styles.daw__timeline}>
                <div class={styles.daw__rulers}>
                  {Array.from({ length: 33 }).map((_, i) => (
                    <div class={styles.daw__ruler}>
                      {i % 4 === 0 && <span>{Math.floor(i / 4) + 1}</span>}
                    </div>
                  ))}
                </div>
                <div class={styles.daw__tracks}>
                  {tracks.map((t) => (
                    <div class={styles.daw__track}>
                      {t.blocks.map((b) => (
                        <div
                          class={styles.daw__block}
                          style={{
                            left: `${b.x}%`,
                            width: `${b.w}%`,
                            background: t.color,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div class={styles.daw__playhead} />
              </div>
            </div>

            {/* Bottom panel — waveform detail */}
            <div class={styles.daw__bottom}>
              <div class={styles.daw__bottomSide}>
                <span class={styles.daw__bottomLabel}>Lead Vox</span>
                <span class={styles.daw__bottomSub}>Waveform</span>
              </div>
              <div class={styles.daw__waveform}>
                {Array.from({ length: 80 }).map(() => (
                  <div
                    class={styles.daw__wavBar}
                    style={{ height: `${12 + Math.random() * 76}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto ── */}
      <section ref={manifestoRef!} class={styles.manifesto}>
        <div ref={manifestoTextRef!} class={styles.manifesto__text}>
          <span class={styles.manifesto__script}>We</span>
          <span class={styles.manifesto__sans}>
            {twText()}<span class={styles.manifesto__cursor} style={{ opacity: twCursor() ? 1 : 0 }}>|</span>
          </span>
        </div>
      </section>

      {/* ── Horizontal scroll capabilities ── */}
      <section ref={hScrollRef!} class={styles.hScroll}>
        <div ref={hScrollTrackRef!} class={styles.hScroll__track}>
          {/* Intro panel */}
          <div class={`${styles.hPanel} ${styles.hPanelIntro}`}>
            <span class={styles.hPanel__introEye}>What it does</span>
            <h2 class={styles.hPanel__introTitle}>
              Four pillars.<br />
              <span class={styles.hPanel__introStroke}>Zero compromise.</span>
            </h2>
          </div>

          {/* Capability panels */}
          {capabilities.map((cap) => (
            <div class={styles.hPanel}>
              <span class={styles.hPanel__num} style={{ color: cap.accent }}>{cap.num}</span>
              <h3 class={styles.hPanel__title}>
                <span class={styles.hPanel__titleScript}>{cap.titleScript}</span>
                {cap.titleBold}
              </h3>
              <p class={styles.hPanel__desc}>{cap.desc}</p>
              <div class={styles.hPanel__tags}>
                {cap.stats.map((s) => (
                  <span class={styles.hPanel__tag}>{s}</span>
                ))}
              </div>
            </div>
          ))}

          {/* End panel */}
          <div class={`${styles.hPanel} ${styles.hPanelEnd}`}>
            <div ref={orbRef!} class={styles.hPanelEnd__orb}>
              <div class={`${styles.hPanelEnd__ring} ${styles.hPanelEnd__ring1}`} />
              <div class={`${styles.hPanelEnd__ring} ${styles.hPanelEnd__ring2}`} />
              <div class={`${styles.hPanelEnd__ring} ${styles.hPanelEnd__ring3}`} />
              <div class={styles.hPanelEnd__core} />
              <div class={styles.hPanelEnd__glow} />
            </div>
            <div class={styles.hPanelEnd__chevrons}>
              <span /><span /><span />
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing manifesto ── */}
      <section class={styles.closing}>
        <p class={styles.closing__text}>
          {closingWords.map((word, i) => (
            <>
              {closingWordImages[word] && (
                <span class={styles.closing__inlineImg}>
                  <img src={closingWordImages[word]} alt="" loading="lazy" />
                </span>
              )}
              <span
                ref={(el: HTMLSpanElement) => (closingWordsRefs[i] = el)}
                class={`${styles.closing__word}${closingAccentWords.has(word) ? ` ${styles.closing__wordAccent}` : ""}`}
              >
                {word}{" "}
              </span>
            </>
          ))}
        </p>
      </section>

      {/* ── Footer ── */}
      <footer ref={footerRef!} class={styles.footer}>
        <div class={styles.footer__info}>
          <span class={styles.footer__backTop} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ back to top</span>
          <div class={styles.footer__links}>
            <span class={styles.footer__accent}>timeline</span>
            <span>mixer</span>
            <span class={styles.footer__accent}>engine</span>
            <span>cloud sync</span>
          </div>
          <div class={styles.footer__links}>
            <span>privacy policy</span>
            <span>terms</span>
          </div>
          <div class={styles.footer__right}>
            <span>© 2026 MeloStudio</span>
            <span>design &amp; dev</span>
          </div>
        </div>
        <div class={styles.footer__brand}>
          <span class={styles.footer__brandLine}>Melo</span>
          <span class={styles.footer__brandLine}>Studio</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
