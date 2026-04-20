// mulberry32 — small, fast, seedable PRNG.
// chosen over xorshift for slightly better distribution at this scale; output is uniform on [0, 1).
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let rng: () => number = Math.random

export function setSeed(seed: number | undefined): void {
  rng = seed === undefined ? Math.random : mulberry32(seed)
}

export function rand(): number {
  return rng()
}
