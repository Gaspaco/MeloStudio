// Timing runs off AudioContext.currentTime, not Date.now(),
// so it stays accurate even when the main thread is busy.

import type { AudioGraph } from "./graph";
import type { AssetManager } from "./assetManager";
import { dbToGain, type Clip, type ClipId, type ProjectDoc } from "./types";

interface ScheduledClip {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAtProjectSec: number;
}

export interface SchedulerOptions {
  // how far ahead to schedule, in seconds. default 0.1s (100ms)
  lookaheadSec?: number;
  // wakeup interval in ms. default 25ms
  tickMs?: number;
}

export class Scheduler {
  private graph: AudioGraph;
  private assets: AssetManager;
  private doc: ProjectDoc | null = null;

  private lookahead: number;
  private tickMs: number;

  // currently scheduled clips, keyed by clip id. reset on stop or seek
  private active = new Map<ClipId, ScheduledClip>();

  private playing = false;

  // AudioContext.currentTime captured at transport start
  private startCtxTime = 0;
  // project time that maps to startCtxTime (playhead position at start)
  private startProjectSec = 0;

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  onTick: ((projectSec: number) => void) | null = null;

  constructor(graph: AudioGraph, assets: AssetManager, opts: SchedulerOptions = {}) {
    this.graph = graph;
    this.assets = assets;
    this.lookahead = opts.lookaheadSec ?? 0.1;
    this.tickMs = opts.tickMs ?? 25;
  }

  setProject(doc: ProjectDoc | null): void {
    if (this.playing) this.stop();
    this.doc = doc;
  }

  get playheadSec(): number {
    if (!this.playing) return this.startProjectSec;
    return this.startProjectSec + (this.graph.ctx.currentTime - this.startCtxTime);
  }

  async start(fromSec: number): Promise<void> {
    if (!this.doc) return;
    if (this.playing) this.stop();

    // Preload every asset the project references before we start ticking.
    const ids = new Set<string>();
    for (const t of this.doc.tracks) for (const c of t.clips) ids.add(c.assetId);
    await this.assets.preload(ids);

    // Re-(up)sert all tracks so the graph matches doc state.
    const anySoloed = this.doc.tracks.some((t) => t.soloed);
    for (const t of this.doc.tracks) this.graph.upsertTrack(t, anySoloed);
    this.graph.setMaster(this.doc.master);

    this.startCtxTime = this.graph.ctx.currentTime;
    this.startProjectSec = fromSec;
    this.playing = true;

    // First tick right away so there's no gap at the very start.
    this.tick();
    this.timerHandle = setInterval(() => this.tick(), this.tickMs);
  }

  stop(): void {
    this.playing = false;
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = null;
    const now = this.graph.ctx.currentTime;
    for (const [, sc] of this.active) {
      try {
        sc.gain.gain.setTargetAtTime(0, now, 0.005);
        sc.source.stop(now + 0.02);
      } catch {
        // already stopped
      }
    }
    this.active.clear();
    this.startProjectSec = this.playheadSec;
  }

  // move playhead while stopped (or jump during play)
  seek(toSec: number): void {
    const wasPlaying = this.playing;
    this.stop();
    this.startProjectSec = Math.max(0, toSec);
    if (wasPlaying) void this.start(this.startProjectSec);
  }

  private tick(): void {
    if (!this.playing || !this.doc) return;

    const ctx = this.graph.ctx;
    const horizon = this.playheadSec + this.lookahead;
    const projectFromCtx = (projectSec: number): number =>
      this.startCtxTime + (projectSec - this.startProjectSec);

    for (const track of this.doc.tracks) {
      const trackInput = this.graph.trackInput(track.id);
      if (!trackInput) continue;

      for (const clip of track.clips) {
        if (clip.muted) continue;
        const clipEnd = clip.startSec + clip.durationSec;
        if (clipEnd <= this.playheadSec) continue;          // already past
        if (clip.startSec > horizon) continue;              // not yet
        if (this.active.has(clip.id)) continue;             // already scheduled

        // When starting mid-clip, offset into the buffer by however much we've missed.
        const offsetIntoClip = Math.max(0, this.playheadSec - clip.startSec);
        const startProjSec = clip.startSec + offsetIntoClip;
        const startCtxSec = projectFromCtx(startProjSec);
        const remainingDur = clip.durationSec - offsetIntoClip;
        if (remainingDur <= 0) continue;

        // Fire-and-forget; we attach when buffer arrives.
        this.assets
          .get(clip.assetId)
          .then((buffer) => {
            if (!this.playing || !this.doc) return;
    // If the moment already passed while the buffer was decoding, skip it.
            if (ctx.currentTime > startCtxSec + 0.01) return;
            this.spawn(clip, trackInput, buffer, startCtxSec, offsetIntoClip, remainingDur);
          })
          .catch((err) => console.warn("clip load failed", clip.id, err));

        // Reserve the slot now so the next tick doesn't double-schedule this clip.
        // spawn() will overwrite the placeholder once the buffer arrives.
        this.active.set(clip.id, {
          source: null as unknown as AudioBufferSourceNode,
          gain: null as unknown as GainNode,
          startedAtProjectSec: startProjSec,
        });
      }
    }

    this.onTick?.(this.playheadSec);
  }

  private spawn(
    clip: Clip,
    trackInput: GainNode,
    buffer: AudioBuffer,
    startCtxSec: number,
    offsetIntoClip: number,
    remainingDur: number,
  ): void {
    const ctx = this.graph.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (clip.pitchSemitones) {
      source.playbackRate.value = Math.pow(2, clip.pitchSemitones / 12);
    }

    const clipGain = ctx.createGain();
    clipGain.gain.value = dbToGain(clip.gainDb);
    source.connect(clipGain);
    clipGain.connect(trackInput);

    const fadeIn = clip.fadeInSec ?? 0;
    const fadeOut = clip.fadeOutSec ?? 0;
    if (fadeIn > 0 && offsetIntoClip < fadeIn) {
      clipGain.gain.setValueAtTime(0, startCtxSec);
      clipGain.gain.linearRampToValueAtTime(
        dbToGain(clip.gainDb),
        startCtxSec + (fadeIn - offsetIntoClip),
      );
    }
    if (fadeOut > 0) {
      const fadeStart = startCtxSec + remainingDur - fadeOut;
      if (fadeStart > startCtxSec) {
        clipGain.gain.setValueAtTime(dbToGain(clip.gainDb), fadeStart);
        clipGain.gain.linearRampToValueAtTime(0, startCtxSec + remainingDur);
      }
    }

    const startInBuffer = clip.offsetSec + offsetIntoClip;
    source.start(startCtxSec, startInBuffer, remainingDur);

    this.active.set(clip.id, {
      source,
      gain: clipGain,
      startedAtProjectSec: clip.startSec + offsetIntoClip,
    });

    source.onended = () => {
      try {
        source.disconnect();
        clipGain.disconnect();
      } catch {
        // noop
      }
      // Only evict this entry if it's still pointing at our source node
      // — a seek may have replaced it.
      const cur = this.active.get(clip.id);
      if (cur?.source === source) this.active.delete(clip.id);
    };
  }
}
