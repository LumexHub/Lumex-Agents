/**
 * Detect volume-based patterns in a series of activity amounts.
 * Improvements:
 * - Added validation of inputs
 * - Calculates additional stats (min, max) per window
 * - Supports dynamic thresholds via function
 * - Returns stronger typed results with variance for volatility
 */

export interface PatternMatch {
  index: number
  window: number
  average: number
  min: number
  max: number
  variance: number
}

export type ThresholdFn = (values: number[], avg: number) => boolean

export function detectVolumePatterns(
  volumes: number[],
  windowSize: number,
  threshold: number | ThresholdFn
): PatternMatch[] {
  if (!Array.isArray(volumes) || volumes.length === 0) return []
  if (windowSize <= 0 || windowSize > volumes.length) return []

  const matches: PatternMatch[] = []

  for (let i = 0; i + windowSize <= volumes.length; i++) {
    const slice = volumes.slice(i, i + windowSize)
    const sum = slice.reduce((a, b) => a + b, 0)
    const avg = sum / windowSize
    const min = Math.min(...slice)
    const max = Math.max(...slice)
    const variance =
      slice.reduce((acc, v) => acc + (v - avg) ** 2, 0) / windowSize

    const condition =
      typeof threshold === "function" ? threshold(slice, avg) : avg >= threshold

    if (condition) {
      matches.push({
        index: i,
        window: windowSize,
        average: Number(avg.toFixed(4)),
        min,
        max,
        variance: Number(variance.toFixed(4)),
      })
    }
  }

  return matches
}

/**
 * Helper to detect bursts (any value in window >= threshold)
 */
export function detectBursts(
  volumes: number[],
  windowSize: number,
  threshold: number
): PatternMatch[] {
  return detectVolumePatterns(volumes, windowSize, (slice) =>
    slice.some((v) => v >= threshold)
  )
}
