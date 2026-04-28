// Render synthesized drum hits to AudioBuffers using OfflineAudioContext.
// One-time render, then they're regular AudioBuffers — same as loaded samples.

export type DrumName = "kick" | "snare" | "hat_closed" | "hat_open" | "clap";
export const DRUM_NAMES: DrumName[] = ["kick", "snare", "hat_closed", "hat_open", "clap"];

const SR = 48000;

function noiseBuffer(ctx: OfflineAudioContext, durSec: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(durSec * SR), SR);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

async function renderKick(): Promise<AudioBuffer> {
  const dur = 0.5;
  const ctx = new OfflineAudioContext(1, dur * SR, SR);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(150, 0);
  osc.frequency.exponentialRampToValueAtTime(40, 0.15);
  gain.gain.setValueAtTime(1, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(0);
  osc.stop(dur);
  return ctx.startRendering();
}

async function renderSnare(): Promise<AudioBuffer> {
  const dur = 0.3;
  const ctx = new OfflineAudioContext(1, dur * SR, SR);
  // Tonal body
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.frequency.setValueAtTime(200, 0);
  osc.frequency.exponentialRampToValueAtTime(120, 0.1);
  oscGain.gain.setValueAtTime(0.5, 0);
  oscGain.gain.exponentialRampToValueAtTime(0.01, 0.1);
  osc.connect(oscGain).connect(ctx.destination);
  // Noise
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, dur);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1000;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.7, 0);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, dur);
  noise.connect(hp).connect(noiseGain).connect(ctx.destination);
  osc.start(0);
  osc.stop(dur);
  noise.start(0);
  noise.stop(dur);
  return ctx.startRendering();
}

async function renderHat(open: boolean): Promise<AudioBuffer> {
  const dur = open ? 0.35 : 0.06;
  const ctx = new OfflineAudioContext(1, dur * SR, SR);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, dur);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, dur);
  noise.connect(hp).connect(gain).connect(ctx.destination);
  noise.start(0);
  noise.stop(dur);
  return ctx.startRendering();
}

async function renderClap(): Promise<AudioBuffer> {
  const dur = 0.25;
  const ctx = new OfflineAudioContext(1, dur * SR, SR);
  const burstAt = [0, 0.012, 0.022, 0.038];
  for (const t of burstAt) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(bp).connect(g).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.05);
  }
  return ctx.startRendering();
}

let cache: Record<DrumName, AudioBuffer> | null = null;

export async function getDrumKit(): Promise<Record<DrumName, AudioBuffer>> {
  if (cache) return cache;
  const [kick, snare, hat_closed, hat_open, clap] = await Promise.all([
    renderKick(),
    renderSnare(),
    renderHat(false),
    renderHat(true),
    renderClap(),
  ]);
  cache = { kick, snare, hat_closed, hat_open, clap };
  return cache;
}
