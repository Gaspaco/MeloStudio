import { type Component, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getAppSession } from "../../lib/app-auth";
import "./home.scss";

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
  let heroRef: HTMLElement | undefined;
  let heroTitleRef: HTMLDivElement | undefined;
  let heroLine1Ref: HTMLDivElement | undefined;
  let heroLine2Ref: HTMLDivElement | undefined;
  let scrollIndRef: HTMLDivElement | undefined;
  let reelRef: HTMLElement | undefined;
  let dawWrapRef: HTMLDivElement | undefined;
  let manifestoRef: HTMLElement | undefined;
  let manifestoTextRef: HTMLDivElement | undefined;
  let hScrollRef: HTMLElement | undefined;
  let hScrollTrackRef: HTMLDivElement | undefined;
  let closingWordsRefs: HTMLSpanElement[] = [];
  let footerRef: HTMLElement | undefined;
  let orbRef: HTMLDivElement | undefined;

  const [twText, setTwText] = createSignal("");
  const [twCursor, setTwCursor] = createSignal(true);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [isLoggedIn, setIsLoggedIn] = createSignal(false);

  onMount(async () => {
    void getAppSession()
      .then((session) => setIsLoggedIn(!!session))
      .catch(() => {});

    if (!heroRef || !heroLine1Ref || !heroLine2Ref || !scrollIndRef || !reelRef || !dawWrapRef || !manifestoRef || !hScrollRef || !hScrollTrackRef || !footerRef || !orbRef) {
      return;
    }

    const hero = heroRef;
    const heroLine1 = heroLine1Ref;
    const heroLine2 = heroLine2Ref;
    const scrollIndicator = scrollIndRef;
    const reel = reelRef;
    const dawWrap = dawWrapRef;
    const manifesto = manifestoRef;
    const hScroll = hScrollRef;
    const hScrollTrack = hScrollTrackRef;
    const footer = footerRef;
    const orb = orbRef;

    animateIntro({
      heroLine1Ref: heroLine1, heroLine2Ref: heroLine2, scrollIndRef: scrollIndicator,
    });

    animateHeroExit({
      heroRef: hero, heroLine1Ref: heroLine1, heroLine2Ref: heroLine2, scrollIndRef: scrollIndicator,
    });

    // Initial rAF refresh after GSAP init; fonts.ready re-refreshes because web fonts shift layout and change ScrollTrigger positions
    requestAnimationFrame(() => ScrollTrigger.refresh());
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});

    let dawInited = false;
    ScrollTrigger.create({
      trigger: reel,
      start: "top 120%",
      once: true,
      onEnter: () => {
        if (!dawInited) {
          dawInited = true;
          animateDaw({ dawWrapRef: dawWrap, reelRef: reel });
        }
      },
    });

    let twCleanup: (() => void) | null = null;
    ScrollTrigger.create({
      trigger: manifesto,
      start: "top 120%",
      once: true,
      onEnter: () => {
        if (!twCleanup) {
          twCleanup = startTypewriter(setTwText, setTwCursor);
        }
      },
    });
    onCleanup(() => twCleanup?.());

    let capsInited = false;
    ScrollTrigger.create({
      trigger: hScroll,
      start: "top 120%",
      once: true,
      onEnter: () => {
        if (!capsInited) {
          capsInited = true;
          animateCapabilities({ hScrollRef: hScroll, hScrollTrackRef: hScrollTrack });
          const cleanupOrb = setupOrb(orb);
          onCleanup(() => cleanupOrb?.());
        }
      },
    });

    let closingInited = false;
    ScrollTrigger.create({
      trigger: ".closing",
      start: "top 130%",
      once: true,
      onEnter: () => {
        if (!closingInited) {
          closingInited = true;
          animateClosing(closingWordsRefs);
        }
      },
    });

    let footerInited = false;
    ScrollTrigger.create({
      trigger: footer,
      start: "top 130%",
      once: true,
      onEnter: () => {
        if (!footerInited) {
          footerInited = true;
          animateFooter(footer);
        }
      },
    });

    createEffect(() => {
      if (menuOpen()) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    });
  });

  onCleanup(() => {
    document.body.style.overflow = "";
    ScrollTrigger.getAll().forEach((t) => t.kill());
  });

  return (
    <div class="page">
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
