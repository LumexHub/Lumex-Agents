export interface PairInfo {
  exchange: string
  pairAddress: string
  baseSymbol: string
  quoteSymbol: string
  liquidityUsd: number
  volume24hUsd: number
  priceUsd: number
  updatedAt?: number
}

export interface DexSuiteConfig {
  apis: Array<{ name: string; baseUrl: string; apiKey?: string }>
  timeoutMs?: number
  maxRetries?: number
}

export class DexSuite {
  private timeoutMs: number
  private maxRetries: number

  constructor(private config: DexSuiteConfig) {
    this.timeoutMs = config.timeoutMs ?? 10000
    this.maxRetries = Math.max(0, config.maxRetries ?? 1)
  }

  private async fetchFromApi<T>(
    api: { name: string; baseUrl: string; apiKey?: string },
    path: string,
    attempt = 0
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(`${api.baseUrl}${path}`, {
        headers: api.apiKey ? { Authorization: `Bearer ${api.apiKey}` } : {},
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`${api.name} ${path} ${res.status}`)
      return (await res.json()) as T
    } catch (err) {
      if (attempt < this.maxRetries) {
        return this.fetchFromApi<T>(api, path, attempt + 1)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Retrieve aggregated pair info across all configured DEX APIs.
   * @param pairAddress Blockchain address of the trading pair
   */
  async getPairInfo(pairAddress: string): Promise<PairInfo[]> {
    const results: PairInfo[] = []
    const tasks = this.config.apis.map(async (api) => {
      try {
        const data = await this.fetchFromApi<any>(api, `/pair/${pairAddress}`)
        results.push({
          exchange: api.name,
          pairAddress,
          baseSymbol: data.token0?.symbol ?? "UNKNOWN",
          quoteSymbol: data.token1?.symbol ?? "UNKNOWN",
          liquidityUsd: Number(data.liquidityUsd ?? 0),
          volume24hUsd: Number(data.volume24hUsd ?? 0),
          priceUsd: Number(data.priceUsd ?? 0),
          updatedAt: Date.now(),
        })
      } catch {
        // skip failed API
      }
    })
    await Promise.all(tasks)
    return results
  }

  /**
   * Compare a list of pairs across exchanges, returning the best volume and liquidity.
   */
  async comparePairs(
    pairs: string[]
  ): Promise<Record<string, { bestVolume: PairInfo; bestLiquidity: PairInfo }>> {
    const entries: Array<[string, { bestVolume: PairInfo; bestLiquidity: PairInfo }]> = []
    for (const addr of pairs) {
      const infos = await this.getPairInfo(addr)
      if (infos.length === 0) continue
      const bestVolume = infos.reduce((a, b) =>
        b.volume24hUsd > a.volume24hUsd ? b : a
      )
      const bestLiquidity = infos.reduce((a, b) =>
        b.liquidityUsd > a.liquidityUsd ? b : a
      )
      entries.push([addr, { bestVolume, bestLiquidity }])
    }
    return Object.fromEntries(entries)
  }

  /**
   * Consolidate data from multiple APIs for a pair into a median snapshot.
   */
  async consolidatePair(pairAddress: string): Promise<{
    pairAddress: string
    baseSymbol: string
    quoteSymbol: string
    medianPriceUsd: number
    totalLiquidityUsd: number
    totalVolume24hUsd: number
    sources: string[]
  } | null> {
    const infos = await this.getPairInfo(pairAddress)
    if (infos.length === 0) return null
    const prices = infos.map((i) => i.priceUsd).filter((p) => Number.isFinite(p))
    prices.sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    const medianPriceUsd =
      prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid]
    const totalLiquidityUsd = infos.reduce((s, i) => s + i.liquidityUsd, 0)
    const totalVolume24hUsd = infos.reduce((s, i) => s + i.volume24hUsd, 0)
    return {
      pairAddress,
      baseSymbol: infos[0].baseSymbol,
      quoteSymbol: infos[0].quoteSymbol,
      medianPriceUsd,
      totalLiquidityUsd,
      totalVolume24hUsd,
      sources: infos.map((i) => i.exchange),
    }
  }
}
