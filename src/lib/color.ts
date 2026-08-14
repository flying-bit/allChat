// Discord-style default palette, each paired with a darker shade for a
// subtle diagonal gradient instead of a flat fill.
const PALETTE: [string, string][] = [
  ["#5865F2", "#4752C4"], // blurple
  ["#23A55A", "#1A7F44"], // green
  ["#F0B232", "#C98F1E"], // yellow
  ["#EB459E", "#C22F80"], // fuchsia
  ["#DA373C", "#B32A2E"], // red
  ["#9C84EF", "#7A5FD1"], // purple
];

function hashOf(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

export function paletteFor(seed: string) {
  return PALETTE[hashOf(seed) % PALETTE.length];
}

export function gradientFor(seed: string) {
  const [from, to] = paletteFor(seed);
  return `linear-gradient(135deg, ${from}, ${to})`;
}
