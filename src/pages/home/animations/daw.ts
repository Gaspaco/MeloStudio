import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const AUDIO_START = 7;
const AUDIO_DURATION = 23;

export function animateDaw(refs: {
  dawWrapRef: HTMLDivElement;
  reelRef: HTMLElement;
}) {
  const audio = refs.dawWrapRef.querySelector("audio") as HTMLAudioElement;

  // defer AudioContext creation until a user gesture to avoid Chrome autoplay block
  let audioCtx: AudioContext | null = null;

  const initAudioContext = () => {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      return;
    }
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(audioCtx.destination);
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  };

  const wavBars = refs.dawWrapRef.querySelectorAll(".daw__wav-bar") as NodeListOf<HTMLElement>;
  const waveformEl = refs.dawWrapRef.querySelector(".daw__waveform") as HTMLElement;

  const volFills = Array.from(refs.dawWrapRef.querySelectorAll(".daw__vol-fill")) as HTMLElement[];
  const volBaseWidths = volFills.map((el) => parseFloat(el.style.width) || 50);
  // quickSetters skip per-frame string-building overhead
  const volWidthSetters = volFills.map((el) => gsap.quickSetter(el, "width", "%"));
  const volOpacitySetters = volFills.map((el) => gsap.quickSetter(el, "opacity"));
  const timeEl = refs.dawWrapRef.querySelector(".daw__time") as HTMLElement | null;

  const barCount = wavBars.length;
  const heightSetters = Array.from(wavBars).map((bar) => gsap.quickSetter(bar, "height", "%"));
  const opacitySetters = Array.from(wavBars).map((bar) => gsap.quickSetter(bar, "opacity"));

  const allBlocks = refs.dawWrapRef.querySelectorAll(".daw__block") as NodeListOf<HTMLElement>;

  const FLOOR = 10;
  const CEIL = 95;
  const range = CEIL - FLOOR;

  // p1/p2 are the two inner control point y-values; x positions are assumed uniform
  const cubicBezier = (t: number, p1: number, p2: number): number => {
    const it = 1 - t;
    return 3 * it * it * t * p1 + 3 * it * t * t * p2 + t * t * t;
  };

  // standard elastic-out — exponential decay * sin gives the bounce
  const elasticOut = (t: number): number => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  };

  const barState = Array.from({ length: barCount }, () => ({
    current: FLOOR,
    velocity: 0,
    randOffset: Math.random() * Math.PI * 2, // stagger vibrato phase per bar
    randScale: 0.6 + Math.random() * 0.5,    // individual height variance
    microFreq: 12 + Math.random() * 5,       // unique vibrato speed per bar
  }));

  const NUM_SWELLS = 3;

  let isPlaying = false;
  let energyBoost = 0;

  const onTick = () => {
    const t = performance.now() / 1000;

    const boostTarget = isPlaying ? 1 : 0;
    energyBoost += (boostTarget - energyBoost) * 0.06;

    const scale = energyBoost;
    const opacityBase = 0.3 + energyBoost * 0.15;
    const opacityRange = 0.4 + energyBoost * 0.25;

    const targets: number[] = new Array(barCount).fill(0);

    for (let s = 0; s < NUM_SWELLS; s++) {
      const speed = 0.6 + s * 0.35;
      const phase = t * speed + s * 2.1;
      const swellCenter = ((Math.sin(phase * 0.4) + 1) / 2);
      const intensity = cubicBezier(
        (Math.sin(phase * 0.7) + 1) / 2,
        0.25, 0.85
      );
      const swellWidth = 0.15 + intensity * 0.25;

      for (let i = 0; i < barCount; i++) {
        const norm = i / barCount;
        const state = barState[i]!;

        let dist = Math.abs(norm - swellCenter);
      dist = Math.min(dist, 1 - dist); // wraps so bars at edges connect to the other side
        if (dist < swellWidth) {
          const swellPos = dist / swellWidth;
          const moundShape = cubicBezier(1 - swellPos, 0.8, 0.2);
          const laggedPhase = phase - swellPos * 0.15;
          const laggedIntensity = cubicBezier(
            (Math.sin(laggedPhase * 0.7) + 1) / 2,
            0.25, 0.85
          );
          const contribution = laggedIntensity * moundShape * state.randScale;
          targets[i] = Math.max(targets[i]!, contribution);
        }
      }
    }

    for (let i = 0; i < barCount; i++) {
      const norm = i / barCount;
      const state = barState[i]!;

      const targetH = FLOOR + targets[i]! * range * scale;
      const diff = targetH - state.current;
      state.velocity += diff * 0.12; // spring constant
      state.velocity *= 0.78; // damping
      state.current += state.velocity;

      // small overshoot from velocity makes the settle feel elastic
      let h = state.current + state.velocity * 0.15;

      const heightRatio = (h - FLOOR) / range;
      if (heightRatio > 0.5) {
        // vibrato only kicks in above half height so quiet bars stay clean
        const vibratoAmount = (heightRatio - 0.5) * 2;
        h += Math.sin(t * state.microFreq + state.randOffset + norm * Math.PI * 7) * vibratoAmount * 1.8;
      }

      h = Math.max(FLOOR, Math.min(CEIL, h));
      heightSetters[i]!(h);
      opacitySetters[i]!(opacityBase + ((h - FLOOR) / range) * opacityRange);
    }

    for (let idx = 0; idx < volFills.length; idx++) {
      const baseWidth = volBaseWidths[idx] ?? 50;
      const pulse = Math.sin(t * (1.4 + idx * 0.3) + idx * 1.7) * 0.5 + 0.5;
      const jitter = Math.sin(t * (7 + idx * 0.8) + idx * 2.3) * 0.03;
      const w = baseWidth + (pulse + jitter) * (100 - baseWidth) * 0.35 * energyBoost;
      volWidthSetters[idx]!(Math.min(100, w));
      volOpacitySetters[idx]!(0.45 + pulse * 0.35 * energyBoost);
    }

    if (timeEl && isPlaying) {
      const elapsed = audio.currentTime - AUDIO_START;
      const mins = Math.floor(Math.max(0, elapsed) / 60);
      const secs = Math.floor(Math.max(0, elapsed) % 60);
      const cs = Math.floor((Math.max(0, elapsed) % 1) * 100);
      timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    }

    if (allBlocks.length > 0) {
      const playheadPct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      for (let b = 0; b < allBlocks.length; b++) {
        const block = allBlocks[b]!;
        const blockLeft = parseFloat(block.style.left);
        const blockRight = blockLeft + parseFloat(block.style.width);
        if (playheadPct >= blockLeft && playheadPct <= blockRight) {
          block.classList.add("daw__block--active");
        } else {
          block.classList.remove("daw__block--active");
        }
      }
    }
  };

  // skip ticker when the reel isn't on screen
  let reelVisible = false;

  ScrollTrigger.create({
    trigger: refs.reelRef,
    start: "top bottom",
    end: "bottom top",
    onEnter: () => { reelVisible = true; },
    onLeave: () => { reelVisible = false; },
    onEnterBack: () => { reelVisible = true; },
    onLeaveBack: () => { reelVisible = false; },
  });

  const onTickGuarded = () => {
    if (!reelVisible && !isPlaying) return;
    onTick();
  };

  gsap.ticker.add(onTickGuarded);

  const startWaveform = () => {
    initAudioContext();
    isPlaying = true;
  };

  const stopWaveform = () => {
    isPlaying = false;
  };

  audio.addEventListener("play", startWaveform);
  audio.addEventListener("pause", stopWaveform);
  
  let playing = false;

  const playhead = refs.dawWrapRef.querySelector(".daw__playhead") as HTMLElement;

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
        onLeave: () => audio.pause(),
        onLeaveBack: () => audio.pause(),
      },
    }
  );

  // Instead of GSAP animating the playhead, we can just toggle active state of blocks inside onTick using audio.currentTime
  // But wait, audio.currentTime is already polled in requestAnimationFrame inside Reel.tsx!
  // To avoid duplicate tickers, we can just let Reel.tsx handle all DOM updating for playhead,
  // OR we can add the block active logic here in a simple ticker.
  // Actually, let's just add it to `onTickGuarded` up at line 165
}
