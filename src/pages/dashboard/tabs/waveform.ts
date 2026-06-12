// Produces a deterministic bar-height array from a string seed so the same project always renders the same waveform shape
export function waveform(seed: string, count = 30): number[] {
  return Array.from({ length: count }, (_, i) => {
    const c = seed.charCodeAt(i % Math.max(seed.length, 1)) || 72;
    return 3 + ((c * 17 + i * 11 + i * i) % 22);
  });
}
