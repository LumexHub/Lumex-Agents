export interface PricePoint {
  timestamp: number
  price: number
}

export interface TokenMetrics {
  averagePrice: number
  volatility: number      // standard deviation
  maxPrice: number
  minPrice: number
}

export interface ExtendedTokenMetrics extends TokenMetrics {
  medianPrice: number
  twap: number                    // time-weighted average price over the series
  maxDrawdown: number             // in decimal, e.g. 0.25 = -25%
  sampleCount: number
  startTime?: number
  endTime?: number
}

export class TokenAnalysisCalculator {
  private data: PricePoint[]

  constructor(points: PricePoint[]) {
    // sanitize + sort ascending by timestamp
    this.data = (Array.isArray(points) ? points : [])
      .filter(p => Number.isFinite(p?.timestamp) && Number.isFinite(p?.price))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  getAveragePrice(): number {
    const n = this.data.length
    if (n === 0) return 0
    let sum = 0
    for (let i = 0; i < n; i++) sum += this.data[i].price
    return sum / n
  }

  getVolatility(): number {
    const n = this.data.length
    if (n === 0) return 0
    const avg = this.getAveragePrice()
    let sumSq = 0
    for (let i = 0; i < n; i++) {
      const d = this.data[i].price - avg
      sumSq += d * d
    }
    const variance = sumSq / n
    return Math.sqrt(variance)
  }

  getMaxPrice(): number {
    const n = this.data.length
    if (n === 0) return 0
    let max = -Infinity
    for (let i = 0; i < n; i++) if (this.data[i].price > max) max = this.data[i].price
    return max
  }

  getMinPrice(): number {
    const n = this.data.length
    if (n === 0) return 0
    let min = Infinity
    for (let i = 0; i < n; i++) if (this.data[i].price < min) min = this.data[i].price
    return min
  }

  getMedianPrice(): number {
    const n = this.data.length
    if (n === 0) return 0
    const sorted = [...this.data].map(p => p.price).sort((a, b) => a - b)
    const mid = Math.floor(n / 2)
    return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  /**
   * Time-Weighted Average Price over the full series.
   * Uses piecewise-constant price between samples.
   */
  getTWAP(): number {
    const n = this.data.length
    if (n === 0) return 0
    if (n === 1) return this.data[0].price

    let weighted = 0
    let totalTime = 0
    for (let i = 0; i < n - 1; i++) {
      const dt = Math.max(0, this.data[i + 1].timestamp - this.data[i].timestamp)
      weighted += this.data[i].price * dt
      totalTime += dt
    }
    // If all timestamps equal, fall back to simple average
    return totalTime > 0 ? weighted / totalTime : this.getAveragePrice()
  }

  /**
   * Simple Moving Average over the last `window` points
   */
  getSMA(window: number): number {
    const n = this.data.length
    const w = Math.max(1, Math.min(window | 0, n))
    if (n === 0) return 0
    let sum = 0
    for (let i = n - w; i < n; i++) sum += this.data[i].price
    return sum / w
  }

  /**
   * Exponential Moving Average over the last `window` points
   */
  getEMA(window: number): number {
    const n = this.data.length
    const w = Math.max(1, window | 0)
    if (n === 0) return 0
    const k = 2 / (w + 1)
    let ema = this.data[0].price
    for (let i = 1; i < n; i++) {
      ema = this.data[i].price * k + ema * (1 - k)
    }
    return ema
  }

  /**
   * Maximum drawdown based on running peak of price
   * Returns a decimal in [0, 1], e.g., 0.3 = -30%
   */
  getMaxDrawdown(): number {
    const n = this.data.length
    if (n === 0) return 0
    let peak = this.data[0].price
    let maxDd = 0
    for (let i = 1; i < n; i++) {
      const px = this.data[i].price
      if (px > peak) peak = px
      const dd = peak > 0 ? (peak - px) / peak : 0
      if (dd > maxDd) maxDd = dd
    }
    return maxDd
  }

  /**
   * Log returns between consecutive points
   */
  getLogReturns(): number[] {
    const out: number[] = []
    for (let i = 1; i < this.data.length; i++) {
      const p0 = this.data[i - 1].price
      const p1 = this.data[i].price
      if (p0 > 0 && p1 > 0) {
        out.push(Math.log(p1 / p0))
      }
    }
    return out
  }

  computeMetrics(): TokenMetrics {
    return {
      averagePrice: this.getAveragePrice(),
      volatility: this.getVolatility(),
      maxPrice: this.getMaxPrice(),
      minPrice: this.getMinPrice(),
    }
  }

  computeExtendedMetrics(): ExtendedTokenMetrics {
    return {
      ...this.computeMetrics(),
      medianPrice: this.getMedianPrice(),
      twap: this.getTWAP(),
      maxDrawdown: this.getMaxDrawdown(),
      sampleCount: this.data.length,
      startTime: this.data[0]?.timestamp,
      endTime: this.data[this.data.length - 1]?.timestamp,
    }
  }
}
