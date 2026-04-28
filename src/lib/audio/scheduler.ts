// Look-ahead scheduler. Runs in the main thread but timing comes from
// AudioContext.currentTime, which is locked to the audio hardware clock.

import type { AudioGraph } from "./graph";
import type { AssetManager } from "./assetManager";
import { dbToGain, type Clip, type ClipId, type ProjectDoc } from "./types";

interface ScheduledClip {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Project-time at which this clip was scheduled to start. */
  startedAtProjectSec: number;
}

export interface SchedulerOptions {
  /** How far ahead to schedule, in seconds. Default 0.1s (100ms). */
  lookaheadSec?: number;
  /** Wakeup interval, in ms. Default 25ms. */
  tickMs?: number;
}

export class Scheduler {
  private graph: AudioGraph;
  private assets: AssetManager;
  private doc: ProjectDoc | null = null;

  private lookahead: number;
  private tickMs: number;

  /** Maps clipId → scheduled instance. Reset on stop or seek. */
  private active = new Map<ClipId, ScheduledClip>();

  /** True while playing. */
  private playing = false;

  /** AudioContext.currentTime when transport began. */
  private startCtxTime = 0;
  /** Project-time corresponding to startCtxTime (i.e. the playhead at start). */
  private startProjectSec = 0;

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  /** Optional callback invoked each tick with current project time. */
  onTick: ((projectSec: number) => void) | null = null;

  constructor(graph: AudioGraph, assets: AssetManager, opts: SchedulerOptions = {}) {
    this.graph = graph;
    this.assets = assets;
    this.lookahead = opts.lookaheadSec ?? 0.1;
    this.tickMs = opts.tickMs ?? 25;
  }

  /** Replace project. Stops playback if already running. */
  setProject(doc: ProjectDoc | null): void {
    if (this.playing) this.stop();
    this.doc = doc;
  }

  /** Current playhead in project time (seconds). */
  get playheadSec(): number {
    if (!this.playing) return this.startProjectSec;
    return this.startProjectSec + (this.graph.ctx.currentTime - this.startCtxTime);
  }

  /** Begin playback at given project time. */
  async start(fromSec: number): Promise<void> {
    if (!this.doc) return;
    if (this.playing) this.stop();

    // Preload every asset referenced by clips that could play soon-ish (the whole project for now).
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

    // First tick immediately, then on interval.
    this.tick();
    this.timerHandle = setInterval(() => this.tick(), this.tickMs);
  }

  /** Stop playback and silence active clips. */
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
        /* already stopped */
      }
    }
    this.active.clear();
    this.startProjectSec = this.playheadSec;
  }

  /** Move playhead while stopped (or jump during play). */
  seek(toSec: number): void {
    const wasPlaying = this.playing;
    this.stop();
    this.startProjectSec = Math.max(0, toSec);
    if (wasPlaying) void this.start(this.startProjectSec);
  }

  // ──────────────────────────────────────────────────────────────────────

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

        // If the playhead is mid-clip, start partway in.
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
            // If the moment already passed (slow decode), skip.
            if (ctx.currentTime > startCtxSec + 0.01) return;
            this.spawn(clip, trackInput, buffer, startCtxSec, offsetIntoClip, remainingDur);
          })
          .catch((err) => console.warn("clip load failed", clip.id, err));

        // Reserve the slot synchronously so we don't double-schedule on the next tick.
        // We store a placeholder; spawn() will overwrite it.
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

    // fades
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
        /* noop */
      }
      // Only remove if still us (seek may have replaced it).
      const cur = this.active.get(clip.id);
      if (cur?.source === source) this.active.delete(clip.id);
    };
  }
}
