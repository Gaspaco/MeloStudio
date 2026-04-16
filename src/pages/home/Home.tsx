import { type Component, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { authClient } from "../../lib/auth";
import "./home.scss";

import Loader from "./sections/Loader";
import Grain from "./sections/Grain";
import Nav from "./sections/Nav";
import Hero from "./sections/Hero";
import Reel from "./sections/Reel";
import Manifesto from "./sections/Manifesto";
import Capabilities from "./sections/Capabilities";
import Closing from "./sections/Closing";
import Footer from "./sections/Footer";

import { animateIntro } from "./animations/intro";
import { animateHeroExit } from "./animations/hero";
import { animateDaw } from "./animations/daw";
import { startTypewriter } from "./animations/typewriter";
import { animateCapabilities } from "./animations/capabilities";
import { animateClosing } from "./animations/closing";
import { animateFooter } from "./animations/footer";
import { setupOrb } from "./animations/orb";

gsap.registerPlugin(ScrollTrigger);

const Home: Component<{ onLogin?: () => void; onSignup?: () => void; onProfile?: () => void }> = (props) => {
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

  const [twText, setTwText] = createSignal("");
  const [twCursor, setTwCursor] = createSignal(true);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [isLoggedIn, setIsLoggedIn] = createSignal(false);

  onMount(async () => {
    try {
      const { data } = await authClient.getSession();
      if (data?.session) setIsLoggedIn(true);
    } catch {}
    // Lenis smooth scroll
    lenisRef = new Lenis({
      duration: 0.9,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenisRef!.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Animations
    animateIntro({
      loaderRef, loaderMeloRef, loaderStudioRef,
      heroLine1Ref, heroLine2Ref, heroMetaRef, scrollIndRef,
    });

    animateHeroExit({
      heroRef, heroLine1Ref, heroLine2Ref, heroMetaRef, scrollIndRef,
    });

    animateDaw({ dawWrapRef, reelRef });

    const cleanupTypewriter = startTypewriter(setTwText, setTwCursor);
    onCleanup(cleanupTypewriter);

    animateCapabilities({ hScrollRef, hScrollTrackRef });
    animateClosing(closingWordsRefs);
    animateFooter(footerRef);
    setupOrb(orbRef);

    createEffect(() => {
      if (menuOpen()) {
        lenisRef?.stop();
        document.body.style.overflow = "hidden";
      } else {
        lenisRef?.start();
        document.body.style.overflow = "";
      }
    });
  });

  onCleanup(() => {
    lenisRef?.destroy();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  });

  return (
    <div class="page">
      <Loader
        ref={(el) => (loaderRef = el)}
        meloRef={(el) => (loaderMeloRef = el)}
        studioRef={(el) => (loaderStudioRef = el)}
      />
      <Grain />
      <Nav
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onLogin={props.onLogin}
        onSignup={props.onSignup}
        isLoggedIn={isLoggedIn}
        onProfile={props.onProfile}
      />
      <Hero
        heroRef={(el) => (heroRef = el)}
        heroTitleRef={(el) => (heroTitleRef = el)}
        heroLine1Ref={(el) => (heroLine1Ref = el)}
        heroLine2Ref={(el) => (heroLine2Ref = el)}
        heroMetaRef={(el) => (heroMetaRef = el)}
        scrollIndRef={(el) => (scrollIndRef = el)}
        onLogin={props.onLogin}
        onSignup={props.onSignup}
        isLoggedIn={isLoggedIn}
        onProfile={props.onProfile}
      />
      <Reel
        reelRef={(el) => (reelRef = el)}
        dawWrapRef={(el) => (dawWrapRef = el)}
      />
      <Manifesto
        manifestoRef={(el) => (manifestoRef = el)}
        manifestoTextRef={(el) => (manifestoTextRef = el)}
        twText={twText}
        twCursor={twCursor}
      />
      <Capabilities
        hScrollRef={(el) => (hScrollRef = el)}
        hScrollTrackRef={(el) => (hScrollTrackRef = el)}
        orbRef={(el) => (orbRef = el)}
      />
      <Closing closingWordsRefs={closingWordsRefs} />
      <Footer footerRef={(el) => (footerRef = el)} />
    </div>
  );
};

export default Home;
