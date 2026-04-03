import fetch from "node-fetch"

/*------------------------------------------------------
 * Types
 *----------------------------------------------------*/

interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export type CandlestickPattern =
  | "Hammer"
  | "ShootingStar"
  | "BullishEngulfing"
  | "BearishEngulfing"
  | "Doji"

export interface PatternSignal {
  timestamp: number
  pattern: CandlestickPattern
  confidence: number // 0..1
}

export interface DetectorOptions {
  requestTimeoutMs?: number
  minConfidence?: number // filter out weak matches
  trendWindow?: number // how many candles to evaluate for directional bias
}

/*------------------------------------------------------
 * Utilities
 *----------------------------------------------------*/

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function isFiniteCandle(c: Candle): boolean {
  return (
    Number.isFinite(c.timestamp) &&
    Number.isFinite(c.open) &&
    Number.isFinite(c.high) &&
    Number.isFinite(c.low) &&
    Number.isFinite(c.close)
  )
}

function byTimestampAsc(a: Candle, b: Candle) {
  return a.timestamp - b.timestamp
}

/*------------------------------------------------------
 * Detector
 *----------------------------------------------------*/

export class CandlestickPatternDetector {
  private readonly timeoutMs: number
  private readonly minConfidence: number
  private readonly trendWindow: number

  constructor(private readonly apiUrl: string, opts: DetectorOptions = {}) {
    this.timeoutMs = Math.max(1000, opts.requestTimeoutMs ?? 10_000)
    this.minConfidence = clamp01(opts.minConfidence ?? 0)
    this.trendWindow = Math.max(2, Math.floor(opts.trendWindow ?? 8))
  }

  /* Fetch recent OHLC candles */
  async fetchCandles(symbol: string, limit = 100): Promise<Candle[]> {
    const url = `${this.apiUrl}/markets/${encodeURIComponent(symbol)}/candles?limit=${Math.max(
      1,
      Math.floor(limit)
    )}`
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url as any, { signal: controller.signal } as any)
      if (!res.ok) {
        throw new Error(`Failed to fetch candles ${res.status}: ${res.statusText}`)
      }
      const data = (await res.json()) as Candle[]
      const clean = Array.isArray(data) ? data.filter(isFiniteCandle) : []
      clean.sort(byTimestampAsc)
      return clean
    } finally {
      clearTimeout(t)
    }
  }

  /* ------------------------- Pattern helpers ---------------------- */

  private body(c: Candle) {
    return Math.abs(c.close - c.open)
  }

  private range(c: Candle) {
    return Math.max(0, c.high - c.low)
  }

  private isHammer(c: Candle): number {
    const body = this.body(c)
    const rng = this.range(c)
    if (rng === 0) return 0
    const lowerWick = Math.min(c.open, c.close) - c.low
    const upperWick = c.high - Math.max(c.open, c.close)
    const lowerRatio = body > 0 ? lowerWick / body : 0
    const bodyToRange = body / rng
    // Hammer: small body near high, long lower shadow, tiny upper shadow
    if (lowerRatio > 2 && bodyToRange < 0.35 && upperWick <= body * 0.5) {
      const score = Math.min(lowerRatio / 3.5, 1)
      return clamp01(score)
    }
    return 0
  }

  private isShootingStar(c: Candle): number {
    const body = this.body(c)
    const rng = this.range(c)
    if (rng === 0) return 0
    const upperWick = c.high - Math.max(c.open, c.close)
    const lowerWick = Math.min(c.open, c.close) - c.low
    const upperRatio = body > 0 ? upperWick / body : 0
    const bodyToRange = body / rng
    // Shooting star: small body near low, long upper shadow, tiny lower shadow
    if (upperRatio > 2 && bodyToRange < 0.35 && lowerWick <= body * 0.5) {
      const score = Math.min(upperRatio / 3.5, 1)
      return clamp01(score)
    }
    return 0
  }

  private isBullishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close > curr.open &&
      prev.close < prev.open &&
      curr.close >= prev.open &&
      curr.open <= prev.close
    if (!cond) return 0
    const bodyPrev = this.body(prev)
    const bodyCurr = this.body(curr)
    if (bodyPrev === 0) return 0.8
    return clamp01(bodyCurr / bodyPrev)
  }

  private isBearishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close < curr.open &&
      prev.close > prev.open &&
      curr.open >= prev.close &&
      curr.close <= prev.open
    if (!cond) return 0
    const bodyPrev = this.body(prev)
    const bodyCurr = this.body(curr)
    if (bodyPrev === 0) return 0.8
    return clamp01(bodyCurr / bodyPrev)
  }

  private isDoji(c: Candle): number {
    const rng = this.range(c)
    const body = this.body(c)
    if (rng === 0) return 0
    const ratio = body / rng
    // Stronger score for very small bodies
    return ratio < 0.12 ? clamp01(1 - ratio / 0.12) : 0
  }

  /* ------------------------- Trend context ------------------------ */

  // Simple directional bias based on slope of closes over the last N candles
  private trendBias(series: Candle[], endIdx: number): number {
    const start = Math.max(0, endIdx - this.trendWindow + 1)
    const slice = series.slice(start, endIdx + 1)
    if (slice.length < 2) return 0
    const first = slice[0].close
    const last = slice[slice.length - 1].close
    if (!Number.isFinite(first) || !Number.isFinite(last)) return 0
    const change = last - first
    const rel = first !== 0 ? change / Math.abs(first) : 0
    // Clamp modestly so that it nudges confidence but doesn't dominate it
    return Math.max(-0.25, Math.min(0.25, rel))
  }

  private applyBias(base: number, bias: number, polarity: "bull" | "bear" | "neutral"): number {
    if (polarity === "neutral") return clamp01(base)
    if (polarity === "bull") return clamp01(base * (1 + Math.max(0, bias)))
    return clamp01(base * (1 + Math.max(0, -bias)))
  }

  /* ------------------------- Public API --------------------------- */

  /**
   * Detect configured candlestick patterns on a series
   */
  detectOnSeries(candles: Candle[]): PatternSignal[] {
    if (!Array.isArray(candles) || candles.length === 0) return []

    const out: PatternSignal[] = []
    const cndl = candles.filter(isFiniteCandle).sort(byTimestampAsc)

    for (let i = 0; i < cndl.length; i++) {
      const c = cndl[i]
      const prev = cndl[i - 1]

      // Single-candle patterns
      const hammer = this.isHammer(c)
      if (hammer >= this.minConfidence) {
        const bias = this.trendBias(cndl, i)
        const conf = this.applyBias(hammer, bias, "bull")
        if (conf >= this.minConfidence) {
          out.push({ timestamp: c.timestamp, pattern: "Hammer", confidence: conf })
        }
      }

      const star = this.isShootingStar(c)
      if (star >= this.minConfidence) {
        const bias = this.trendBias(cndl, i)
        const conf = this.applyBias(star, bias, "bear")
        if (conf >= this.minConfidence) {
          out.push({ timestamp: c.timestamp, pattern: "ShootingStar", confidence: conf })
        }
      }

      const doji = this.isDoji(c)
      if (doji >= this.minConfidence) {
        // Doji treated as neutral, no trend bias
        if (doji >= this.minConfidence) {
          out.push({ timestamp: c.timestamp, pattern: "Doji", confidence: doji })
        }
      }

      // Two-candle patterns
      if (prev) {
        const bullEng = this.isBullishEngulfing(prev, c)
        if (bullEng >= this.minConfidence) {
          const bias = this.trendBias(cndl, i)
          const conf = this.applyBias(bullEng, bias, "bull")
          if (conf >= this.minConfidence) {
            out.push({ timestamp: c.timestamp, pattern: "BullishEngulfing", confidence: conf })
          }
        }

        const bearEng = this.isBearishEngulfing(prev, c)
        if (bearEng >= this.minConfidence) {
          const bias = this.trendBias(cndl, i)
          const conf = this.applyBias(bearEng, bias, "bear")
          if (conf >= this.minConfidence) {
            out.push({ timestamp: c.timestamp, pattern: "BearishEngulfing", confidence: conf })
          }
        }
      }
    }

    // Sort newest -> oldest by timestamp
    out.sort((a, b) => b.timestamp - a.timestamp)
    return out
  }

  /**
   * Convenience method: fetch candles and run detection
   */
  async detect(symbol: string, limit = 100): Promise<PatternSignal[]> {
    const candles = await this.fetchCandles(symbol, limit)
    return this.detectOnSeries(candles)
  }
}
