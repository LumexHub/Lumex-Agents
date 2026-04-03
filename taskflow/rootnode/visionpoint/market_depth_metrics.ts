/**
 * Analyze on-chain orderbook depth for a given market.
 * Improvements:
 * - Adds timeout + basic retries for fetch
 * - Sanitizes and sorts orderbook sides (bids: desc, asks: asc)
 * - Keeps the original DepthMetrics shape for compatibility
 * - Adds an optional `analyzeAdvanced` for richer metrics (mid, spread bps, VWAP, imbalance)
 */

export interface Order {
  price: number
  size: number
}

export interface DepthMetrics {
  averageBidDepth: number
  averageAskDepth: number
  spread: number
}

export interface AdvancedDepthMetrics extends DepthMetrics {
  midPrice: number
  spreadBps: number
  vwapBidTop5: number
  vwapAskTop5: number
  depthImbalance: number // (bidSum - askSum) / (bidSum + askSum)
}

export interface DepthAnalyzerOptions {
  timeoutMs?: number
  maxRetries?: number
}

export class TokenDepthAnalyzer {
  private timeoutMs: number
  private maxRetries: number

  constructor(
    private rpcEndpoint: string,
    private marketId: string,
    opts: DepthAnalyzerOptions = {}
  ) {
    this.timeoutMs = Math.max(1_000, opts.timeoutMs ?? 8_000)
    this.maxRetries = Math.max(0, opts.maxRetries ?? 2)
  }

  async fetchOrderbook(depth = 50): Promise<{ bids: Order[]; asks: Order[] }> {
    const safeDepth = Math.max(1, Math.floor(depth))
    const url = `${this.rpcEndpoint}/orderbook/${this.marketId}?depth=${safeDepth}`
    return this.fetchWithRetry(url)
  }

  async analyze(depth = 50): Promise<DepthMetrics> {
    const { bids, asks } = await this.fetchOrderbook(depth)
    const sbids = this.sanitize(bids, "desc")
    const sasks = this.sanitize(asks, "asc")

    const avg = (arr: Order[]) =>
      arr.length ? arr.reduce((s, o) => s + o.size, 0) / arr.length : 0

    const bestBid = sbids[0]?.price ?? 0
    const bestAsk = sasks[0]?.price ?? 0

    return {
      averageBidDepth: avg(sbids),
      averageAskDepth: avg(sasks),
      spread: bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0,
    }
  }

  async analyzeAdvanced(depth = 50): Promise<AdvancedDepthMetrics> {
    const { bids, asks } = await this.fetchOrderbook(depth)
    const sbids = this.sanitize(bids, "desc")
    const sasks = this.sanitize(asks, "asc")

    const basic = await this.analyze(depth)
    const bestBid = sbids[0]?.price ?? 0
    const bestAsk = sasks[0]?.price ?? 0
    const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0
    const spreadBps = midPrice > 0 ? (basic.spread / midPrice) * 10_000 : 0

    const vwapBidTop5 = this.vwap(sbids, 5)
    const vwapAskTop5 = this.vwap(sasks, 5)

    const bidSum = this.sumSize(sbids, depth)
    const askSum = this.sumSize(sasks, depth)
    const denom = bidSum + askSum
    const depthImbalance = denom > 0 ? (bidSum - askSum) / denom : 0

    return {
      ...basic,
      midPrice,
      spreadBps,
      vwapBidTop5,
      vwapAskTop5,
      depthImbalance,
    }
  }

  // ---------- internals ----------

  private async fetchWithRetry(url: string, attempt = 0): Promise<{ bids: Order[]; asks: Order[] }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`Orderbook fetch failed: HTTP ${res.status}`)
      const json = (await res.json()) as { bids: Order[]; asks: Order[] }
      if (!json || !Array.isArray(json.bids) || !Array.isArray(json.asks)) {
        throw new Error("Malformed orderbook payload")
      }
      return json
    } catch (err) {
      if (attempt < this.maxRetries) {
        await this.sleep(200 * (attempt + 1))
        return this.fetchWithRetry(url, attempt + 1)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private sanitize(side: Order[], sort: "asc" | "desc"): Order[] {
    const clean = side.filter(
      (o) =>
        typeof o?.price === "number" &&
        typeof o?.size === "number" &&
        Number.isFinite(o.price) &&
        Number.isFinite(o.size) &&
        o.price > 0 &&
        o.size > 0
    )
    clean.sort((a, b) => (sort === "asc" ? a.price - b.price : b.price - a.price))
    return clean
  }

  private vwap(levels: Order[], n: number): number {
    const k = Math.max(0, Math.min(levels.length, Math.floor(n)))
    if (k === 0) return 0
    let notional = 0
    let volume = 0
    for (let i = 0; i < k; i++) {
      notional += levels[i].price * levels[i].size
      volume += levels[i].size
    }
    return volume > 0 ? notional / volume : 0
  }

  private sumSize(levels: Order[], n: number): number {
    const k = Math.max(0, Math.min(levels.length, Math.floor(n)))
    let total = 0
    for (let i = 0; i < k; i++) total += levels[i].size
    return total
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }
}
