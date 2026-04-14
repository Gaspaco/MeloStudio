import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const AUDIO_START = 7;
const AUDIO_DURATION = 23;

export function animateDaw(refs: {
  dawWrapRef: HTMLDivElement;
  reelRef: HTMLElement;
}) {
  // Using hate-me.mp3 because hate-me.wav is missing from the public/ folder.
  // The browser throws "NotSupportedError" when it gets a 404 page instead of an audio file!
  const audio = new Audio("/hate-me.mp3");
  audio.volume = 0.6;
  audio.preload = "auto";

  // Lazy setup for Web Audio API to prevent Chrome Autoplay Policy errors
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let timeData: Uint8Array | null = null;

  const initAudioContext = () => {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      return;
    }
    
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.55;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    timeData = new Uint8Array(analyser.fftSize);
    
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  };

  // Grab the waveform bars
  const wavBars = refs.dawWrapRef.querySelectorAll(".daw__wav-bar") as NodeListOf<HTMLElement>;
  const waveformEl = refs.dawWrapRef.querySelector(".daw__waveform") as HTMLElement;

  // Sidebar volume fills + time display
  const volFills = Array.from(refs.dawWrapRef.querySelectorAll(".daw__vol-fill")) as HTMLElement[];
  const volBaseWidths = volFills.map((el) => parseFloat(el.style.width) || 50);
  const timeEl = refs.dawWrapRef.querySelector(".daw__time") as HTMLElement | null;

  const barCount = wavBars.length;

  // Set up individual gsap quickSetter functions for each bar (ultra fast)
  const heightSetters = Array.from(wavBars).map((bar) => gsap.quickSetter(bar, "height", "%"));
  const opacitySetters = Array.from(wavBars).map((bar) => gsap.quickSetter(bar, "opacity"));

  // ── Mirrored Bézier-curved waveform with phrasing, weighted swells, and elastic settle ──
  const FLOOR = 10;
  const CEIL = 95;
  const range = CEIL - FLOOR;

  // Cubic Bézier helper (approximate ease via 1D cubic Bézier with control points)
  // p1, p2 are the y-values of the two control points (x assumed evenly spaced)
  const cubicBezier = (t: number, p1: number, p2: number): number => {
    const it = 1 - t;
    return 3 * it * it * t * p1 + 3 * it * t * t * p2 + t * t * t;
  };

  // Elastic-out easing: bounce when settling
  const elasticOut = (t: number): number => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  };

  // Per-bar state for elastic settling + unique traits
  const barState = Array.from({ length: barCount }, () => ({
    current: FLOOR,
    velocity: 0,
    // Add some random noise and scale factor per bar for an organic, imperfect look
    randOffset: Math.random() * Math.PI * 2,
    randScale: 0.6 + Math.random() * 0.5, // 0.6x to 1.1x multiplier
    microFreq: 12 + Math.random() * 5, // Random micro-vibrato speeds per bar
  }));

  // Define swell groups: overlapping phrase "mounds" that travel across the waveform
  const NUM_SWELLS = 3;

  // Energy boost: ramps up when playing, dims when paused/stopped
  let isPlaying = false;
  let energyBoost = 0; // 0 = idle, 1 = full playing energy

  const onTick = () => {
    const t = performance.now() / 1000;

    // Smoothly ramp energyBoost toward target
    const boostTarget = isPlaying ? 1 : 0;
    energyBoost += (boostTarget - energyBoost) * 0.06;

    // Idle vs playing: no movement when idle, full movement when playing
    const idleScale = 0.0; // flat floor when paused
    const playScale = 1.0;
    const scale = idleScale + energyBoost * (playScale - idleScale);

    // Brightness boost when playing
    const opacityBase = 0.3 + energyBoost * 0.15;
    const opacityRange = 0.4 + energyBoost * 0.25;

    // ── Build target heights from coordinated swell groups ──
    const targets: number[] = new Array(barCount).fill(0);

    for (let s = 0; s < NUM_SWELLS; s++) {
      // Each swell has its own timing, width, and position
      const speed = 0.6 + s * 0.35;
      const phase = t * speed + s * 2.1;

      // Swell center drifts across the bar field (wraps around)
      const swellCenter = ((Math.sin(phase * 0.4) + 1) / 2);

      // Swell intensity pulses like vocal phrases
      const intensity = cubicBezier(
        (Math.sin(phase * 0.7) + 1) / 2,
        0.25, 0.85
      );

      // Swell width varies (wider during loud, narrower during quiet)
      const swellWidth = 0.15 + intensity * 0.25;

      for (let i = 0; i < barCount; i++) {
        const norm = i / barCount;
        const state = barState[i]!;

        // Distance from swell center (wrapping)
        let dist = Math.abs(norm - swellCenter);
        dist = Math.min(dist, 1 - dist); // wrap around edges

        if (dist < swellWidth) {
          // Normalized position within swell (0 = center, 1 = edge)
          const swellPos = dist / swellWidth;

          // Bézier-curved mound shape: rounded, organic, not triangular
          // Center bars get full intensity, edges taper with a smooth curve
          const moundShape = cubicBezier(1 - swellPos, 0.8, 0.2);

          // Weighted center: center of swell leads, edges lag behind
          const lagDelay = swellPos * 0.15;
          const laggedPhase = phase - lagDelay;
          const laggedIntensity = cubicBezier(
            (Math.sin(laggedPhase * 0.7) + 1) / 2,
            0.25, 0.85
          );

          // Apply the bar's unique random scale factor so the wave feels jagged and organic
          const contribution = laggedIntensity * moundShape * state.randScale;
          targets[i] = Math.max(targets[i]!, contribution);
        }
      }
    }

    // ── Per-bar processing: vibrato, elastic settle, final output ──
    for (let i = 0; i < barCount; i++) {
      const norm = i / barCount;
      const target = targets[i]!;
      const state = barState[i]!;

      // Target height in % — scaled by idle/playing energy
      const targetH = FLOOR + target * range * scale;

      // Elastic-out settle: bars spring toward target with bounce
      const diff = targetH - state.current;
      state.velocity += diff * 0.12; // spring force
      state.velocity *= 0.78; // damping
      state.current += state.velocity;

      // Apply elastic overshoot on the velocity for the bounce feel
      const overshoot = state.velocity * 0.15;
      let h = state.current + overshoot;

      // Micro-vibrato: only when bar is above 50% height
      const heightRatio = (h - FLOOR) / range;
      if (heightRatio > 0.5) {
        const vibratoAmount = (heightRatio - 0.5) * 2; // 0→1 above 50%
        // Scatter vibrato frequencies and phases slightly per-bar
        const vibrato = Math.sin(t * state.microFreq + state.randOffset + norm * Math.PI * 7) * vibratoAmount * 1.8;
        h += vibrato;
      }

      // Clamp
      h = Math.max(FLOOR, Math.min(CEIL, h));
      const o = opacityBase + ((h - FLOOR) / range) * opacityRange;

      heightSetters[i]!(h);
      opacitySetters[i]!(o);
    }

    // ── Animate sidebar volume meters ──
    volFills.forEach((fill, idx) => {
      if (!fill) return;
      // Each track gets a slightly different pulse rhythm
      const baseWidth = volBaseWidths[idx] ?? 50;
      const pulse = Math.sin(t * (1.4 + idx * 0.3) + idx * 1.7) * 0.5 + 0.5;
      const jitter = Math.sin(t * (7 + idx * 0.8) + idx * 2.3) * 0.03;
      const w = baseWidth + (pulse + jitter) * (100 - baseWidth) * 0.35 * energyBoost;
      fill.style.width = `${Math.min(100, w)}%`;
      fill.style.opacity = `${0.45 + pulse * 0.35 * energyBoost}`;
    });

    // ── Animate time counter ──
    if (timeEl && playing) {
      const elapsed = audio.currentTime - AUDIO_START;
      const mins = Math.floor(Math.max(0, elapsed) / 60);
      const secs = Math.floor(Math.max(0, elapsed) % 60);
      const cs = Math.floor((Math.max(0, elapsed) % 1) * 100);
      timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    }
  };

  // Use gsap.ticker instead of requestAnimationFrame
  gsap.ticker.add(onTick);

  const startWaveform = () => {
    initAudioContext();
    isPlaying = true;
  };

  const stopWaveform = () => {
    isPlaying = false;
  };
  
  let playing = false;
  let started = false;
  let playheadTween: gsap.core.Tween | null = null;

  const startAudio = () => {
    if (playing) return;
    playing = true;
    if (!started) {
      audio.currentTime = AUDIO_START;
      started = true;
    }
    
    audio.play().then(() => {
      if (playing && playheadTween) {
        playheadTween.play();
      }
      startWaveform();
    }).catch((e) => {
      console.warn("Audio blocked or failed to play.", e);
      playing = false; // Reset if it failed
    });
  };

  const stopAudio = () => {
    if (!playing) return;
    playing = false;
    audio.pause();
    if (playheadTween) playheadTween.pause();
    stopWaveform();
  };

  // Add click listeners to the DAW UI buttons
  const playBtn = refs.dawWrapRef.querySelector(".daw__btn-play") as HTMLElement;
  const stopBtn = refs.dawWrapRef.querySelector(".daw__btn-stop") as HTMLElement;

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (playing) {
        // Toggle pause
        stopAudio();
        playBtn.classList.remove("daw__btn-play--active");
      } else {
        // Toggle play
        startAudio();
        playBtn.classList.add("daw__btn-play--active");
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      stopAudio();
      if (playBtn) playBtn.classList.remove("daw__btn-play--active");
      
      // Reset to beginning
      started = false;
      audio.currentTime = AUDIO_START;
      if (playheadTween) {
        playheadTween.progress(0);
      }
    });
  }

  // Animate the DAW container scaling up when scrolling
  gsap.fromTo(
    refs.dawWrapRef,
    { scale: 0.12, opacity: 0, borderRadius: "24px" },
    {
      scale: 1,
      opacity: 1,
      borderRadius: "0px",
      ease: "none",
      scrollTrigger: {
        trigger: refs.reelRef,
        start: "top top",
        end: "+=200%",
        pin: true,
        scrub: 0.8,
        // We removed the auto-play on scroll here to respect Autoplay policies!
        onLeave: () => stopAudio(), // Still safe to pause if they scroll far away
        onLeaveBack: () => stopAudio(), // Still safe to pause if they scroll back up
      },
    }
  );

  const playhead = refs.dawWrapRef.querySelector(".daw__playhead") as HTMLElement;
  const allBlocks = refs.dawWrapRef.querySelectorAll(".daw__block") as NodeListOf<HTMLElement>;

  if (playhead && allBlocks.length) {
    const timeline = refs.dawWrapRef.querySelector(".daw__timeline") as HTMLElement;

    playheadTween = gsap.fromTo(
      playhead,
      { left: "0%" },
      {
        left: "100%",
        duration: AUDIO_DURATION,
        repeat: -1,
        ease: "none",
        delay: 0,
        paused: true,
        onRepeat() {
          audio.currentTime = AUDIO_START;
        },
        onUpdate() {
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
              block.classList.add("daw__block--active");
            } else {
              block.classList.remove("daw__block--active");
            }
          });
        },
      }
    );
  }
}
