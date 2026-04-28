// AudioGraph: per-track gain + pan, summing into a master gain.
// Pure Web Audio nodes — no Solid coupling. State changes flow in via methods.

import { dbToGain, type Track, type MasterBus, type TrackId } from "./types";

interface TrackNodes {
  input: GainNode;        // sums all clip outputs for this track
  panner: StereoPannerNode;
  output: GainNode;       // post-pan, post-gain
  gainDb: number;
  pan: number;
  muted: boolean;
}

export class AudioGraph {
  readonly ctx: AudioContext;
  private master: GainNode;
  private tracks = new Map<TrackId, TrackNodes>();

  /** Returns the GainNode where a clip should connect for the given track.
   *  null if track isn't in the graph (caller must add it first). */
  trackInput(id: TrackId): GainNode | null {
    return this.tracks.get(id)?.input ?? null;
  }

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
  }

  /** Apply or update master settings. */
  setMaster(m: MasterBus): void {
    this.master.gain.setTargetAtTime(
      dbToGain(m.gainDb),
      this.ctx.currentTime,
      0.01,
    );
  }

  /** Add or update a track's nodes. Idempotent. */
  upsertTrack(t: Track, anySoloed: boolean): void {
    let nodes = this.tracks.get(t.id);
    if (!nodes) {
      const input = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      const output = this.ctx.createGain();
      input.connect(panner);
      panner.connect(output);
      output.connect(this.master);
      nodes = { input, panner, output, gainDb: 0, pan: 0, muted: false };
      this.tracks.set(t.id, nodes);
    }
    const now = this.ctx.currentTime;
    // gain: muted or (anySoloed && !this.soloed) → 0; else dbToGain(t.gainDb)
    const audible = !t.muted && (!anySoloed || t.soloed);
    const targetGain = audible ? dbToGain(t.gainDb) : 0;
    nodes.output.gain.setTargetAtTime(targetGain, now, 0.01);
    nodes.panner.pan.setTargetAtTime(t.pan, now, 0.01);
    nodes.gainDb = t.gainDb;
    nodes.pan = t.pan;
    nodes.muted = t.muted;
  }

  removeTrack(id: TrackId): void {
    const n = this.tracks.get(id);
    if (!n) return;
    n.input.disconnect();
    n.panner.disconnect();
    n.output.disconnect();
    this.tracks.delete(id);
  }

  /** Disconnect everything; safe to GC. */
  destroy(): void {
    for (const id of [...this.tracks.keys()]) this.removeTrack(id);
    this.master.disconnect();
  }
}
