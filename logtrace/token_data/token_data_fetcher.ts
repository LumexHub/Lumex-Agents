export interface TokenDataPoint {
  timestamp: number
  priceUsd: number
  volumeUsd: number
  marketCapUsd: number
}

export interface FetchResult<T> {
  success: boolean
  data?: T
  error?: string
}

export class TokenDataFetcher {
  constructor(private apiBase: string, private timeoutMs: number = 10000) {}

  private async safeFetch(url: string): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Fetches historical data points for the given token symbol.
   * Endpoint: `${apiBase}/tokens/${symbol}/history`
   */
  async fetchHistory(symbol: string): Promise<FetchResult<TokenDataPoint[]>> {
    try {
      const url = `${this.apiBase}/tokens/${encodeURIComponent(symbol)}/history`
      const raw = (await this.safeFetch(url)) as any[]

      const data: TokenDataPoint[] = raw.map(r => ({
        timestamp: r.time * 1000,
        priceUsd: Number(r.priceUsd),
        volumeUsd: Number(r.volumeUsd),
        marketCapUsd: Number(r.marketCapUsd),
      }))

      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  /**
   * Get the most recent data point for a token.
   */
  async fetchLatest(symbol: string): Promise<FetchResult<TokenDataPoint>> {
    const history = await this.fetchHistory(symbol)
    if (!history.success || !history.data || history.data.length === 0) {
      return { success: false, error: history.error ?? "No data returned" }
    }
    const latest = history.data[history.data.length - 1]
    return { success: true, data: latest }
  }

  /**
   * Compute basic statistics from the fetched history.
   */
  async fetchStats(symbol: string): Promise<FetchResult<{ avgPrice: number; avgVolume: number }>> {
    const history = await this.fetchHistory(symbol)
    if (!history.success || !history.data || history.data.length === 0) {
      return { success: false, error: history.error ?? "No data returned" }
    }

    const prices = history.data.map(p => p.priceUsd)
    const volumes = history.data.map(p => p.volumeUsd)

    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length

    return { success: true, data: { avgPrice, avgVolume } }
  }
}
