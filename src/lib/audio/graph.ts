// AudioGraph is responsible for the actual Web Audio signal chain.
// It sets up the routing: Clips -> Track Input Gain -> Track Panner -> Track Output Gain -> Master Gain -> Destination.
// By keeping all the Web Audio logic here, we decouple the audio processing 
// from SolidJS and UI state, updating it only via manual imperative calls.

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

  trackInput(id: TrackId): GainNode | null {
    return this.tracks.get(id)?.input ?? null;
  }

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
  }

  setMaster(m: MasterBus): void {
    this.master.gain.setTargetAtTime(
      dbToGain(m.gainDb),
      this.ctx.currentTime,
      0.01,
    );
  }

  // Upserts (adds or updates) a track in the audio graph. 
  // It's perfectly safe to call this whenever track state changes (e.g. volume slider moved).
  // It uses `setTargetAtTime` to gracefully glide to the new volume, avoiding clicks/pops.
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
    // gain: muted or (anySoloed && !this.soloed) = 0, otherwise dbToGain(t.gainDb)
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

  destroy(): void {
    for (const id of [...this.tracks.keys()]) this.removeTrack(id);
    this.master.disconnect();
  }
}
