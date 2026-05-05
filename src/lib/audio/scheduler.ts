// The Scheduler is responsible for playing audio accurately.
// It uses the "A Tale of Two Clocks" approach:
// 1. A Javascript timer (setInterval) wakes up periodically (the 'tick').
// 2. On each tick, it looks ahead into the future and schedules audio events 
//    using the Web Audio API's highly accurate `AudioContext.currentTime`.
// This ensures that even if the main thread is blocked, audio never stutters.

import type { AudioGraph } from "./graph";
import type { AssetManager } from "./assetManager";
import { dbToGain, type Clip, type ClipId, type ProjectDoc } from "./types";

interface ScheduledClip {
  source: AudioBufferSourceNode;
  gain: GainNode;
  // project time at which this clip was scheduled to start
  startedAtProjectSec: number;
}

export interface SchedulerOptions {
  // How far ahead into the future to schedule, in seconds. Default is 100ms.
  // Larger lookaheads are safer against CPU spikes, but increase the latency
  // whenever playback needs to stop or seek (since scheduled nodes are hard to cancel).
  lookaheadSec?: number;
  
  // The wakeup interval for the setInterval timer, in milliseconds.
  // This determines how often the scheduler wakes up to check if more audio needs scheduling.
  // Default is 25ms, which is frequent enough to keep the lookahead buffer filled.
  tickMs?: number;
}

export class Scheduler {
  private graph: AudioGraph;
  private assets: AssetManager;
  private doc: ProjectDoc | null = null;

  private lookahead: number;
  private tickMs: number;

  // We maintain a map of currently scheduled clips so we can stop them if the user pauses or seeks,
  // and to ensure we don't accidentally schedule the same clip twice.
  private active = new Map<ClipId, ScheduledClip>();

  private playing = false;

  // Web Audio's context clock starts at 0 when the page loads and never stops.
  // We capture it when the user presses play so we can map project time to context time.
  private startCtxTime = 0;
  
  // The playhead position in seconds when playback was last started.
  private startProjectSec = 0;

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  // optional callback invoked each tick with current project time
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

  // Returns the current playhead position in project time (seconds).
  // When stopped, it's just the last saved position.
  // When playing, it sweeps forward from the start time, syncing exactly with the Web Audio context clock.
  get playheadSec(): number {
    if (!this.playing) return this.startProjectSec;
    return this.startProjectSec + (this.graph.ctx.currentTime - this.startCtxTime);
  }

  // Starts the timeline playing from a specific project time in seconds.
  // This involves preloading assets, upserting tracks to the graph, 
  // and capturing the synchronization points for our two clocks.
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
      }
    }
    this.active.clear();
    this.startProjectSec = this.playheadSec;
  }

  // move playhead while stopped or playing.
  // If playing, clips will be rescheduled on the next tick because the seek
  // stops the transport, updates the start project time, and restarts the transport,
  // which clears the `active` list and recalculates `startCtxTime`.
  seek(toSec: number): void {
    const wasPlaying = this.playing;
    this.stop();
    this.startProjectSec = Math.max(0, toSec);
    if (wasPlaying) void this.start(this.startProjectSec);
  }

  // The core loop of the scheduler. It is called repeatedly by setInterval.
  // Its job is to look slightly ahead of the current playhead, find any clips 
  // that need to start playing during that window, and schedule them on the Web Audio API.
  private tick(): void {
    if (!this.playing || !this.doc) return;

    // Use the extremely reliable AudioContext clock to determine where we are.
    const ctx = this.graph.ctx;
    
    // Calculate the right edge of our scheduling window.
    // Anything that starts before this horizon gets scheduled now.
    const horizon = this.playheadSec + this.lookahead;
    
    // A mapping helper: it takes a time on the project line (in seconds)
    // and converts it to corresponding time on the AudioContext line.
    const projectFromCtx = (projectSec: number): number =>
      this.startCtxTime + (projectSec - this.startProjectSec);

    for (const track of this.doc.tracks) {
      const trackInput = this.graph.trackInput(track.id);
      if (!trackInput) continue;

      for (const clip of track.clips) {
        if (clip.muted) continue;
        const clipEnd = clip.startSec + clip.durationSec;
        // We skip clips that are entirely past the playhead,
        // ones that start after the lookahead horizon,
        // and ones we have already scheduled.
        if (clipEnd <= this.playheadSec) continue;          
        if (clip.startSec > horizon) continue;              
        if (this.active.has(clip.id)) continue;             

        // If the user starts playback in the middle of a clip, 
        // we figure out how far into the clip we should start playing.
        const offsetIntoClip = Math.max(0, this.playheadSec - clip.startSec);
        
        // This calculates the project time and exact AudioContext time
        // when this clip needs to be scheduled to hit the speakers.
        const startProjSec = clip.startSec + offsetIntoClip;
        const startCtxSec = projectFromCtx(startProjSec);
        
        // Calculate how much audio buffer is actually left to play.
        const remainingDur = clip.durationSec - offsetIntoClip;
        if (remainingDur <= 0) continue;

        // Fetching the audio buffer is asynchronous.
        // We set up the fetch and attach the audio to the graph when it arrives.
        this.assets
          .get(clip.assetId)
          .then((buffer) => {
            if (!this.playing || !this.doc) return;
            // The buffer might load too late! If the moment it was supposed to play 
            // has already passed by more than 10ms, just drop it so it doesn't sound delayed.
            if (ctx.currentTime > startCtxSec + 0.01) return;
            this.spawn(clip, trackInput, buffer, startCtxSec, offsetIntoClip, remainingDur);
          })
          .catch((err) => console.warn("clip load failed", clip.id, err));

        // We mark the clip as active immediately with placeholder nodes.
        // This prevents the next `tick` from trying to schedule the same clip again
        // while the buffer is still downloading. The `spawn` method will replace 
        // these placeholders with the real nodes once the fetch completes.
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
      }
      // Only evict this entry if it's still pointing at our source node
      // — a seek may have replaced it.
      const cur = this.active.get(clip.id);
      if (cur?.source === source) this.active.delete(clip.id);
    };
  }
}
