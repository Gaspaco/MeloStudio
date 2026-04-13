export interface Capability {
  num: string;
  title: string;
  titleBold: string;
  titleScript: string;
  desc: string;
  stats: string[];
  accent: string;
}

export const capabilities: Capability[] = [
  {
    num: "01",
    title: "Timeline",
    titleBold: "line",
    titleScript: "Time",
    desc: "Multi-track sequencing with snap-to-grid precision. Drag, trim, loop — non-destructive editing that respects your flow.",
    stats: ["Unlimited tracks", "Crossfade", "BPM sync"],
    accent: "#ccff00",
  },
  {
    num: "02",
    title: "WASM Engine",
    titleBold: "Engine",
    titleScript: "WASM",
    desc: "C++ audio DSP compiled to WebAssembly. Sub-3ms latency, zero crackle. Desktop-grade processing, zero installs.",
    stats: ["64-bit float", "SIMD", "Offline render"],
    accent: "#00f0ff",
  },
  {
    num: "03",
    title: "Mixer",
    titleBold: "er",
    titleScript: "Mix",
    desc: "Full effects chain per channel. EQ, compressor, reverb — VST-class processing inside your browser tab.",
    stats: ["Sidechain", "Automation", "Bus routing"],
    accent: "#ff0055",
  },
  {
    num: "04",
    title: "Cloud Sync",
    titleBold: "Sync",
    titleScript: "Cloud",
    desc: "Every session persisted in real-time. Pick up where you left off, on any device, anywhere in the world.",
    stats: ["Version history", "Real-time collab", "WAV / MP3"],
    accent: "#8c00ff",
  },
];
