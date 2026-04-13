export interface Track {
  label: string;
  color: string;
  vol: number;
  blocks: { x: number; w: number }[];
}

export const tracks: Track[] = [
  { label: "Lead Vox", color: "#ccff00", vol: 82, blocks: [{ x: 8, w: 22 }, { x: 34, w: 18 }, { x: 58, w: 26 }] },
  { label: "Backing", color: "#aadd00", vol: 65, blocks: [{ x: 14, w: 38 }, { x: 56, w: 30 }] },
  { label: "Pad", color: "#00f0ff", vol: 48, blocks: [{ x: 0, w: 42 }, { x: 48, w: 40 }] },
  { label: "Keys", color: "#00b3ff", vol: 70, blocks: [{ x: 6, w: 16 }, { x: 26, w: 32 }, { x: 62, w: 24 }] },
  { label: "808", color: "#ff0055", vol: 90, blocks: [{ x: 0, w: 12 }, { x: 16, w: 12 }, { x: 32, w: 12 }, { x: 48, w: 12 }, { x: 64, w: 12 }] },
  { label: "Clap", color: "#ff00a0", vol: 55, blocks: [{ x: 5, w: 5 }, { x: 15, w: 5 }, { x: 25, w: 5 }, { x: 35, w: 5 }, { x: 45, w: 5 }, { x: 55, w: 5 }, { x: 65, w: 5 }] },
  { label: "Hi-Hat", color: "#ffffff", vol: 40, blocks: [{ x: 0, w: 3 }, { x: 5, w: 3 }, { x: 10, w: 3 }, { x: 15, w: 3 }, { x: 20, w: 3 }, { x: 25, w: 3 }, { x: 30, w: 3 }, { x: 35, w: 3 }, { x: 40, w: 3 }, { x: 45, w: 3 }, { x: 50, w: 3 }, { x: 55, w: 3 }, { x: 60, w: 3 }, { x: 65, w: 3 }, { x: 70, w: 3 }] },
  { label: "Sub Bass", color: "#8c00ff", vol: 88, blocks: [{ x: 0, w: 30 }, { x: 34, w: 28 }, { x: 66, w: 22 }] },
  { label: "FX Riser", color: "#555555", vol: 35, blocks: [{ x: 20, w: 28 }, { x: 60, w: 20 }] },
  { label: "Perc", color: "#888888", vol: 45, blocks: [{ x: 2, w: 4 }, { x: 8, w: 4 }, { x: 14, w: 4 }, { x: 22, w: 4 }, { x: 30, w: 4 }, { x: 38, w: 4 }, { x: 46, w: 4 }, { x: 54, w: 4 }, { x: 62, w: 4 }, { x: 70, w: 4 }] },
];
