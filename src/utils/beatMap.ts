import type { LevelData } from '../types/LevelData';

/**
 * Extend a level's hand-authored hitTimes so the playable track fills (almost) the
 * whole song instead of ending less than halfway through.
 *
 * Strategy: keep every original (musically hand-placed) turn, then from the last one
 * append beat-aligned turns in a repeating "phrase" pattern — short runs of one-beat
 * turns separated by a breath — until we approach the end of the audio.
 */
export interface BeatExtendOpts {
  bpm: number;
  durationMs: number;
  endPadMs?: number;   // stop this far before the song ends
}

export function extendHitTimes(original: number[], opts: BeatExtendOpts): number[] {
  const { bpm, durationMs, endPadMs = 3500 } = opts;
  if (!original.length) return original;

  const beat = 60000 / bpm;            // ms per beat
  const limit = durationMs - endPadMs;
  const out = [...original];
  let t = original[original.length - 1];
  if (t >= limit) return out;          // already long enough

  // deterministic phrase pattern: 4 turns 1 beat apart, then a 2-beat rest, repeat —
  // with an occasional longer rest so it doesn't feel mechanical
  const pattern = [1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 3];
  let i = 0;
  while (true) {
    const step = pattern[i % pattern.length] * beat;
    t += step;
    if (t >= limit) break;
    out.push(Math.round(t));
    i++;
  }
  return out;
}

/** Apply full-length extension to a level in place-safe (returns a new level object). */
export function extendLevel(level: LevelData, bpm: number, durationMs: number): LevelData {
  return { ...level, hitTimes: extendHitTimes(level.hitTimes, { bpm, durationMs }) };
}
