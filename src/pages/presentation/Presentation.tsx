import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import gsap from "gsap";
import {
  Monitor, DollarSign, HardDrive, Mountain, Ban, Share2,
  Piano, Guitar, Drum, Music, Music2, Music4, Volume2, Disc3,
  Layers, Mic, Headphones, SlidersHorizontal,
  Upload, MessageCircle, UserPlus, Rss,
  KeyboardMusic, AudioWaveform,
  CirclePlay, Zap,
  ChevronLeft, ChevronRight, House,
} from "lucide-solid";
import "./presentation.scss";

interface Slide {
  id: string;
  label: string;
  render: () => any;
}

export default function TechPage() {
  const [current, setCurrent] = createSignal(0);
  const [transitioning, setTransitioning] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let touchStartX = 0;

  const slides: Slide[] = [
    // ── 0: Title ──
    {
      id: "title",
      label: "Intro",
      render: () => (
        <div class="sl sl--title">
          <div class="sl__bg-glow sl__bg-glow--pink" />
          <div class="sl__bg-glow sl__bg-glow--blue sl__bg-glow--offset" />
          <span class="sl__tag">Browser-Native Digital Audio Workstation</span>
          <h1 class="sl__hero">
            <span class="sl__hero-word">Melo</span>
            <span class="sl__hero-word sl__hero-word--accent">Studio</span>
          </h1>
          <p class="sl__subtitle">Your studio. Your browser. <strong>Your sound.</strong></p>
          <p class="sl__subtitle-sub">No downloads. No plugins. No subscriptions. Just music.</p>
          <div class="sl__hint">
            <span>Press</span>
            <kbd>→</kbd>
            <span>or click the arrows to navigate</span>
          </div>
        </div>
      ),
    },

    // ── 1: The Problem ──
    {
      id: "problem",
      label: "Problem",
      render: () => (
        <div class="sl sl--problem">
          <div class="sl__bg-glow sl__bg-glow--orange" />
          <span class="sl__slide-num">01</span>
          <span class="sl__eyebrow">The Problem</span>
          <h2 class="sl__heading">Making music shouldn't require a <span class="sl__pink">$500 license</span></h2>
          <div class="sl__problem-grid">
            <div class="sl__problem-card">
              <div class="sl__problem-icon"><DollarSign size={28} /></div>
              <h3>Expensive Software</h3>
              <p>FL Studio, Ableton, Logic — all cost hundreds of dollars. Students, hobbyists, and beginners are priced out before they even start.</p>
            </div>
            <div class="sl__problem-card">
              <div class="sl__problem-icon"><HardDrive size={28} /></div>
              <h3>Heavy Installs</h3>
              <p>Traditional DAWs need 5-20GB of disk space, specific OS versions, and compatible audio drivers. Switch computers? Start over.</p>
            </div>
            <div class="sl__problem-card">
              <div class="sl__problem-icon"><Mountain size={28} /></div>
              <h3>Steep Learning Curve</h3>
              <p>100+ page manuals, confusing menus, overwhelming interfaces. Most people quit before making their first beat.</p>
            </div>
            <div class="sl__problem-card">
              <div class="sl__problem-icon"><Ban size={28} /></div>
              <h3>No Easy Sharing</h3>
              <p>Finished a track? Now bounce, export, upload to SoundCloud, share a link… There's no built-in way to just publish and share instantly.</p>
            </div>
          </div>
        </div>
      ),
    },

    // ── 2: The Solution ──
    {
      id: "solution",
      label: "Solution",
      render: () => (
        <div class="sl sl--solution">
          <div class="sl__bg-glow sl__bg-glow--pink" />
          <div class="sl__bg-glow sl__bg-glow--green sl__bg-glow--offset" />
          <span class="sl__slide-num">02</span>
          <span class="sl__eyebrow">The Solution</span>
          <h2 class="sl__heading">A <span class="sl__pink">full DAW</span> that lives in your browser</h2>
          <div class="sl__features-row">
            <div class="sl__feature">
              <div class="sl__feature-icon" style={{ background: "rgba(224,82,151,0.12)", "border-color": "rgba(224,82,151,0.25)" }}>
                <Monitor size={22} color="#e05297" />
              </div>
              <h3>100% Browser-Based</h3>
              <p>Open a tab and start producing. Works on Chrome, Edge, Firefox — any device, anywhere.</p>
            </div>
            <div class="sl__feature">
              <div class="sl__feature-icon" style={{ background: "rgba(184,224,96,0.12)", "border-color": "rgba(184,224,96,0.25)" }}>
                <Zap size={22} color="#b8e060" />
              </div>
              <h3>Completely Free</h3>
              <p>No subscriptions, no trials, no feature gates. Every instrument, every tool — free for everyone.</p>
            </div>
            <div class="sl__feature">
              <div class="sl__feature-icon" style={{ background: "rgba(96,184,224,0.12)", "border-color": "rgba(96,184,224,0.25)" }}>
                <Share2 size={22} color="#60b8e0" />
              </div>
              <h3>Instant Sharing</h3>
              <p>Hit publish, get a link. Your track has its own page with waveform, comments, and likes — built in.</p>
            </div>
          </div>
        </div>
      ),
    },

    // ── 3: Studio Features ──
    {
      id: "studio",
      label: "Studio",
      render: () => (
        <div class="sl sl--stack">
          <div class="sl__bg-glow sl__bg-glow--pink" />
          <span class="sl__slide-num">03</span>
          <span class="sl__eyebrow">Core Features</span>
          <h2 class="sl__heading">Everything you need to <span class="sl__pink">produce</span></h2>
          <div class="sl__tech-grid sl__tech-grid--2x2">
            <div class="sl__tech-card sl__tech-card--hero">
              <div class="sl__tech-badge" style={{ background: "rgba(224,82,151,0.15)", color: "#e05297" }}>
                <Layers size={18} />
              </div>
              <div>
                <h3>Multi-Track Timeline</h3>
                <p>Layer unlimited audio and MIDI tracks. Drag, trim, loop, and arrange clips on a professional-grade timeline with snap-to-grid precision.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(184,224,96,0.15)", color: "#b8e060" }}>
                <Mic size={18} />
              </div>
              <div>
                <h3>Live Recording</h3>
                <p>Record audio from your mic or line-in. Capture MIDI from hardware keyboards in real time with zero-latency monitoring.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(96,184,224,0.15)", color: "#60b8e0" }}>
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h3>Mixing Console</h3>
                <p>Per-track volume, pan, mute, and solo. Real-time level meters and a master channel for final output control.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(224,168,96,0.15)", color: "#e0a860" }}>
                <Drum size={18} />
              </div>
              <div>
                <h3>Drum Machine</h3>
                <p>16-step sequencer with per-hit velocity, swing control, and multi-bar pattern looping. Program beats visually or tap them in.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ── 4: Instruments ──
    {
      id: "instruments",
      label: "Sounds",
      render: () => (
        <div class="sl sl--instruments">
          <div class="sl__bg-glow sl__bg-glow--green" />
          <span class="sl__slide-num">04</span>
          <span class="sl__eyebrow">Sound Library</span>
          <h2 class="sl__heading"><span class="sl__pink">15+</span> instruments. Zero downloads.</h2>
          <p class="sl__body-text">Every sound is loaded on-demand and plays through the browser's audio engine. No sample packs to install.</p>
          <div class="sl__instrument-grid">
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Piano size={18} /></div>
              <div><span class="sl__instrument-name">Grand Piano</span><span class="sl__instrument-desc">Multi-velocity sampled</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Guitar size={18} /></div>
              <div><span class="sl__instrument-name">Electric Guitar</span><span class="sl__instrument-desc">Clean & overdriven</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Music size={18} /></div>
              <div><span class="sl__instrument-name">Saxophone</span><span class="sl__instrument-desc">Alto & tenor</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Drum size={18} /></div>
              <div><span class="sl__instrument-name">Drum Kits</span><span class="sl__instrument-desc">808, acoustic, lo-fi</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><AudioWaveform size={18} /></div>
              <div><span class="sl__instrument-name">Synth Pads</span><span class="sl__instrument-desc">Warm analog-modeled</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Music2 size={18} /></div>
              <div><span class="sl__instrument-name">Strings</span><span class="sl__instrument-desc">Orchestral ensemble</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Volume2 size={18} /></div>
              <div><span class="sl__instrument-name">Bass</span><span class="sl__instrument-desc">Sub, electric, synth</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Music4 size={18} /></div>
              <div><span class="sl__instrument-name">Brass</span><span class="sl__instrument-desc">Trumpet, trombone</span></div>
            </div>
            <div class="sl__instrument-chip">
              <div class="sl__instrument-icon"><Disc3 size={18} /></div>
              <div><span class="sl__instrument-name">Percussion</span><span class="sl__instrument-desc">Congas, shakers, claps</span></div>
            </div>
          </div>
        </div>
      ),
    },

    // ── 5: Social & Sharing ──
    {
      id: "social",
      label: "Social",
      render: () => (
        <div class="sl sl--stack">
          <div class="sl__bg-glow sl__bg-glow--pink" />
          <div class="sl__bg-glow sl__bg-glow--orange sl__bg-glow--offset" />
          <span class="sl__slide-num">05</span>
          <span class="sl__eyebrow">Community</span>
          <h2 class="sl__heading">Share your music with the <span class="sl__pink">world</span></h2>
          <div class="sl__tech-grid sl__tech-grid--2x2">
            <div class="sl__tech-card sl__tech-card--hero">
              <div class="sl__tech-badge" style={{ background: "rgba(224,82,151,0.15)", color: "#e05297" }}>
                <Upload size={18} />
              </div>
              <div>
                <h3>One-Click Publish</h3>
                <p>Hit publish from the studio and your track gets its own dedicated share page — complete with cover art, waveform player, and project metadata.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(184,224,96,0.15)", color: "#b8e060" }}>
                <MessageCircle size={18} />
              </div>
              <div>
                <h3>Comments & Likes</h3>
                <p>Listeners can drop feedback, like your tracks, and engage with your music directly on the share page.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(96,184,224,0.15)", color: "#60b8e0" }}>
                <UserPlus size={18} />
              </div>
              <div>
                <h3>Follow Artists</h3>
                <p>Build your audience. Follow other producers, get followed back, and grow your community of listeners.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(224,168,96,0.15)", color: "#e0a860" }}>
                <Rss size={18} />
              </div>
              <div>
                <h3>Social Feed</h3>
                <p>Discover new tracks from producers you follow. A curated feed of fresh music from the MeloStudio community.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ── 6: Audio Engine ──
    {
      id: "engine",
      label: "Engine",
      render: () => (
        <div class="sl sl--stack">
          <div class="sl__bg-glow sl__bg-glow--green" />
          <span class="sl__slide-num">06</span>
          <span class="sl__eyebrow">Under the Hood</span>
          <h2 class="sl__heading">Professional-grade <span class="sl__pink">audio engine</span></h2>
          <div class="sl__tech-grid">
            <div class="sl__tech-card sl__tech-card--hero">
              <div class="sl__tech-badge" style={{ background: "rgba(184,224,96,0.15)", color: "#b8e060" }}>
                <Headphones size={18} />
              </div>
              <div>
                <h3>Tone.js + Web Audio API</h3>
                <p>The same Web Audio API that powers professional audio apps — running a custom AudioContext at 48kHz sample rate with a 128-sample buffer for under 3ms round-trip latency. PolySynth with envelope shaping, filter sweeps, and real-time parameter automation.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(184,224,96,0.15)", color: "#b8e060" }}>
                <KeyboardMusic size={18} />
              </div>
              <div>
                <h3>Web MIDI Integration</h3>
                <p>Plug in any MIDI keyboard and play. Full running-status decoding, velocity sensitivity, real-time note capture during recording, and automatic device detection.</p>
              </div>
            </div>
            <div class="sl__tech-card">
              <div class="sl__tech-badge" style={{ background: "rgba(184,224,96,0.15)", color: "#b8e060" }}>
                <AudioWaveform size={18} />
              </div>
              <div>
                <h3>WaveSurfer.js Visualization</h3>
                <p>Real-time waveform rendering on the share page and studio timeline. Interactive seek with cursor tracking, zoom controls, and smooth playback scrubbing.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ── 7: Tech Stack ──
    {
      id: "stack",
      label: "Stack",
      render: () => (
        <div class="sl sl--stack">
          <div class="sl__bg-glow sl__bg-glow--blue" />
          <span class="sl__slide-num">07</span>
          <span class="sl__eyebrow">Built With</span>
          <h2 class="sl__heading">The <span class="sl__pink">tech stack</span></h2>
          <div class="sl__stack-split">
            <div class="sl__stack-col">
              <h3 class="sl__stack-col-title">Frontend</h3>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#448aff" }} />
                <div>
                  <strong>SolidJS</strong>
                  <span>Fine-grained reactivity — no virtual DOM. Signals drive every knob, fader, and waveform without re-rendering the tree.</span>
                </div>
              </div>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#3178c6" }} />
                <div>
                  <strong>TypeScript</strong>
                  <span>End-to-end type safety from API routes to audio scheduling.</span>
                </div>
              </div>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#cd6799" }} />
                <div>
                  <strong>SCSS + BEM</strong>
                  <span>Design tokens, modular partials, consistent theming across 30+ components.</span>
                </div>
              </div>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#88CE02" }} />
                <div>
                  <strong>GSAP + Three.js</strong>
                  <span>ScrollTrigger page transitions, 3D WebGL particles, 60fps micro-interactions everywhere.</span>
                </div>
              </div>
            </div>
            <div class="sl__stack-col">
              <h3 class="sl__stack-col-title">Backend</h3>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#60b8e0" }} />
                <div>
                  <strong>SolidStart / Vinxi</strong>
                  <span>SSR, file-based routing, server functions, and lazy-loaded pages with Suspense.</span>
                </div>
              </div>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#00e5a0" }} />
                <div>
                  <strong>Neon Postgres</strong>
                  <span>Serverless PostgreSQL with zero cold-start. Projects, sessions, social graph — all in one place.</span>
                </div>
              </div>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#00c7b7" }} />
                <div>
                  <strong>Netlify Edge</strong>
                  <span>CDN deployment with Blobs storage for audio clips and cover art assets.</span>
                </div>
              </div>
              <div class="sl__stack-item">
                <div class="sl__stack-dot" style={{ background: "#f97316" }} />
                <div>
                  <strong>Better Auth + Zod</strong>
                  <span>OAuth sessions and runtime schema validation at every API boundary.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ── 8: Design System ──
    {
      id: "design",
      label: "Design",
      render: () => (
        <div class="sl sl--design">
          <div class="sl__bg-glow sl__bg-glow--pink" />
          <span class="sl__slide-num">08</span>
          <span class="sl__eyebrow">Visual Identity</span>
          <h2 class="sl__heading">Design <span class="sl__pink">system</span></h2>
          <div class="sl__design-grid">
            <div class="sl__design-block">
              <span class="sl__design-label">Display</span>
              <span class="sl__design-font sl__design-font--display">Syne</span>
              <span class="sl__design-sample sl__design-sample--display">Bold, expressive headlines</span>
            </div>
            <div class="sl__design-block">
              <span class="sl__design-label">Body</span>
              <span class="sl__design-font sl__design-font--sans">Inter</span>
              <span class="sl__design-sample sl__design-sample--sans">Clean, readable interfaces</span>
            </div>
            <div class="sl__design-block">
              <span class="sl__design-label">Mono</span>
              <span class="sl__design-font sl__design-font--mono">JetBrains</span>
              <span class="sl__design-sample sl__design-sample--mono">Technical precision</span>
            </div>
          </div>
          <div class="sl__palette">
            <div class="sl__swatch" style={{ background: "#e05297" }}><span>#e05297</span></div>
            <div class="sl__swatch" style={{ background: "#b8e060" }}><span>#b8e060</span></div>
            <div class="sl__swatch" style={{ background: "#07070a", border: "1px solid rgba(255,255,255,0.1)" }}><span>#07070a</span></div>
            <div class="sl__swatch" style={{ background: "#f2f0ed" }}><span class="sl__swatch-dark">#f2f0ed</span></div>
            <div class="sl__swatch" style={{ background: "#807b72" }}><span>#807b72</span></div>
          </div>
          <p class="sl__design-note">Every color, radius, shadow, and spacing value comes from a shared token system — one change propagates across the entire app.</p>
        </div>
      ),
    },

    // ── 9: Stats ──
    {
      id: "stats",
      label: "Stats",
      render: () => (
        <div class="sl sl--stats">
          <div class="sl__bg-glow sl__bg-glow--green" />
          <span class="sl__slide-num">09</span>
          <span class="sl__eyebrow">Performance</span>
          <h2 class="sl__heading">By the <span class="sl__pink">numbers</span></h2>
          <div class="sl__stats-grid">
            <div class="sl__stat-block">
              <span class="sl__stat-number">48<span class="sl__stat-unit">kHz</span></span>
              <span class="sl__stat-desc">Sample Rate</span>
              <span class="sl__stat-detail">Studio-quality audio output</span>
            </div>
            <div class="sl__stat-block">
              <span class="sl__stat-number">{"<"}3<span class="sl__stat-unit">ms</span></span>
              <span class="sl__stat-desc">Audio Latency</span>
              <span class="sl__stat-detail">Real-time playback & recording</span>
            </div>
            <div class="sl__stat-block">
              <span class="sl__stat-number">15<span class="sl__stat-unit">+</span></span>
              <span class="sl__stat-desc">Instruments</span>
              <span class="sl__stat-detail">Sampled & synthesized</span>
            </div>
            <div class="sl__stat-block">
              <span class="sl__stat-number">0<span class="sl__stat-unit">ms</span></span>
              <span class="sl__stat-desc">Cold Start</span>
              <span class="sl__stat-detail">Serverless Neon Postgres</span>
            </div>
            <div class="sl__stat-block">
              <span class="sl__stat-number">60<span class="sl__stat-unit">fps</span></span>
              <span class="sl__stat-desc">Animations</span>
              <span class="sl__stat-detail">GSAP-powered throughout</span>
            </div>
            <div class="sl__stat-block">
              <span class="sl__stat-number">SSR</span>
              <span class="sl__stat-desc">First Paint</span>
              <span class="sl__stat-detail">Server-rendered, instant load</span>
            </div>
          </div>
        </div>
      ),
    },

    // ── 10: End CTA ──
    {
      id: "end",
      label: "End",
      render: () => (
        <div class="sl sl--end">
          <div class="sl__bg-glow sl__bg-glow--pink" />
          <div class="sl__bg-glow sl__bg-glow--blue sl__bg-glow--offset" />
          <span class="sl__end-quote">"Music is the universal language of mankind."</span>
          <h2 class="sl__end-title">
            <span class="sl__end-word">Ready to</span>{" "}
            <span class="sl__end-word sl__end-word--accent">create?</span>
          </h2>
          <div class="sl__end-buttons">
            <a href="/login" class="sl__end-btn sl__end-btn--primary">
              <CirclePlay size={18} />
              Open MeloStudio
            </a>
            <a href="/" class="sl__end-btn sl__end-btn--secondary">
              Learn More
              <ChevronRight size={16} />
            </a>
          </div>
          <div class="sl__end-footer">
            <span>MeloStudio · Built with SolidJS, Tone.js & passion · {new Date().getFullYear()}</span>
          </div>
        </div>
      ),
    },
  ];

  const goTo = (index: number) => {
    if (transitioning() || index === current() || index < 0 || index >= slides.length) return;
    setTransitioning(true);

    const dir = index > current() ? 1 : -1;
    const outEl = containerRef?.querySelector(".sl") as HTMLElement | null;

    if (outEl) {
      gsap.to(outEl, {
        opacity: 0,
        y: dir * -60,
        duration: 0.35,
        ease: "power3.in",
        onComplete: () => {
          setCurrent(index);
          requestAnimationFrame(() => {
            const inEl = containerRef?.querySelector(".sl") as HTMLElement | null;
            if (inEl) {
              hideAnimatedChildren(inEl);
              gsap.fromTo(inEl, { opacity: 0, y: dir * 60 }, {
                opacity: 1, y: 0, duration: 0.5, ease: "power3.out",
                onComplete: () => {
                  setTransitioning(false);
                  animateSlide(inEl);
                },
              });
            } else {
              setTransitioning(false);
            }
          });
        },
      });
    } else {
      setCurrent(index);
      setTransitioning(false);
    }
  };

  const next = () => goTo(current() + 1);
  const prev = () => goTo(current() - 1);

  const STAGGER_SELECTOR = ".sl__tech-card, .sl__col, .sl__design-block, .sl__stat-block, .sl__swatch, .sl__problem-card, .sl__feature, .sl__instrument-chip, .sl__stack-item";
  const WORD_SELECTOR = ".sl__hero-word, .sl__end-word";

  const hideAnimatedChildren = (el: HTMLElement) => {
    const staggerEls = el.querySelectorAll(STAGGER_SELECTOR);
    if (staggerEls.length) gsap.set(staggerEls, { opacity: 0, y: 25, scale: 0.97 });
    const words = el.querySelectorAll(WORD_SELECTOR);
    if (words.length) gsap.set(words, { yPercent: 100, opacity: 0 });
    const quote = el.querySelector(".sl__end-quote");
    if (quote) gsap.set(quote, { opacity: 0, y: -20 });
  };

  const animateSlide = (el: HTMLElement) => {
    const staggerEls = el.querySelectorAll(STAGGER_SELECTOR);
    if (staggerEls.length) {
      gsap.to(staggerEls, {
        opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.055, ease: "power3.out",
      });
    }
    const words = el.querySelectorAll(WORD_SELECTOR);
    if (words.length) {
      gsap.to(words, {
        yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power4.out",
      });
    }
    const quote = el.querySelector(".sl__end-quote");
    if (quote) {
      gsap.to(quote, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" });
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    if (e.key === "Home") { e.preventDefault(); goTo(0); }
    if (e.key === "End") { e.preventDefault(); goTo(slides.length - 1); }
  };

  const onTouchStart = (e: TouchEvent) => { touchStartX = e.touches[0]?.clientX ?? 0; };
  const onTouchEnd = (e: TouchEvent) => {
    const end = e.changedTouches[0]?.clientX ?? 0;
    const delta = end - touchStartX;
    if (Math.abs(delta) > 50) delta > 0 ? prev() : next();
  };

  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      e.preventDefault();
      e.deltaY > 0 ? next() : prev();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", onKey);
    containerRef?.addEventListener("wheel", onWheel, { passive: false });
    containerRef?.addEventListener("touchstart", onTouchStart, { passive: true });
    containerRef?.addEventListener("touchend", onTouchEnd, { passive: true });
    requestAnimationFrame(() => {
      const el = containerRef?.querySelector(".sl") as HTMLElement | null;
      if (el) {
        hideAnimatedChildren(el);
        animateSlide(el);
      }
    });
  });

  onCleanup(() => {
    window.removeEventListener("keydown", onKey);
    containerRef?.removeEventListener("wheel", onWheel);
    containerRef?.removeEventListener("touchstart", onTouchStart);
    containerRef?.removeEventListener("touchend", onTouchEnd);
  });

  return (
    <div class="deck" ref={containerRef}>
      {/* Progress bar */}
      <div class="deck__progress">
        <div class="deck__progress-fill" style={{ width: `${((current() + 1) / slides.length) * 100}%` }} />
      </div>

      {/* Slide */}
      <div class="deck__slide">
        {slides[current()]?.render()}
      </div>

      {/* Navigation dots */}
      <div class="deck__dots">
        <For each={slides}>
          {(slide, i) => (
            <button
              class={`deck__dot${i() === current() ? " deck__dot--active" : ""}`}
              onClick={() => goTo(i())}
              aria-label={slide.label}
            >
              <span class="deck__dot-label">{slide.label}</span>
            </button>
          )}
        </For>
      </div>

      {/* Arrow buttons */}
      <Show when={current() > 0}>
        <button class="deck__arrow deck__arrow--prev" onClick={prev} aria-label="Previous slide">
          <ChevronLeft size={20} />
        </button>
      </Show>
      <Show when={current() < slides.length - 1}>
        <button class="deck__arrow deck__arrow--next" onClick={next} aria-label="Next slide">
          <ChevronRight size={20} />
        </button>
      </Show>

      {/* Slide counter */}
      <div class="deck__counter">
        <span>{String(current() + 1).padStart(2, "0")}</span>
        <span class="deck__counter-sep">/</span>
        <span>{String(slides.length).padStart(2, "0")}</span>
      </div>

      {/* Back to home */}
      <a href="/" class="deck__home" aria-label="Back to home">
        <House size={16} />
        <span>Home</span>
      </a>

    </div>
  );
}
