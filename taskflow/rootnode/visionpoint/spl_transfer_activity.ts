/**
 * Analyze on-chain token activity: fetch recent signatures and summarize transfers.
 * Improvements:
 * - Uses Solana JSON-RPC (POST) with timeout + basic retries
 * - Filters transactions by mint and computes deltas using integer amounts
 * - Handles missing fields safely and sorts results by time (desc)
 */

export interface ActivityRecord {
  timestamp: number
  signature: string
  source: string
  destination: string
  amount: number
}

type Commitment = "processed" | "confirmed" | "finalized"

interface RpcRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: unknown[]
}
interface RpcResponse<T> {
  jsonrpc: "2.0"
  id: number
  result?: T
  error?: { code: number; message: string }
}

interface SignatureInfo {
  signature: string
  err: null | unknown
  blockTime: number | null
}
interface UiTokenAmount {
  amount: string // integer string
  decimals: number
  uiAmount: number | null
}
interface TokenBalanceEntry {
  owner?: string
  mint: string
  uiTokenAmount: UiTokenAmount
}
interface TransactionMeta {
  preTokenBalances?: TokenBalanceEntry[]
  postTokenBalances?: TokenBalanceEntry[]
}
interface TransactionResult {
  blockTime: number | null
  meta: TransactionMeta | null
}

export interface AnalyzerOptions {
  commitment?: Commitment
  timeoutMs?: number
  maxRetries?: number
}

export class TokenActivityAnalyzer {
  private id = 1
  private timeoutMs: number
  private maxRetries: number
  private commitment: Commitment

  constructor(private rpcEndpoint: string, opts: AnalyzerOptions = {}) {
    this.timeoutMs = Math.max(1_000, opts.timeoutMs ?? 10_000)
    this.maxRetries = Math.max(0, opts.maxRetries ?? 2)
    this.commitment = opts.commitment ?? "confirmed"
  }

  private async rpc<T>(method: string, params?: unknown[], attempt = 0): Promise<T> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    const body: RpcRequest = { jsonrpc: "2.0", id: this.id++, method, params }
    try {
      const res = await fetch(this.rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
      const json = (await res.json()) as RpcResponse<T>
      if (json.error) throw new Error(`RPC ${method}: ${json.error.code} ${json.error.message}`)
      if (json.result === undefined) throw new Error(`RPC ${method}: empty result`)
      return json.result
    } catch (e) {
      if (attempt < this.maxRetries) {
        await this.sleep(200 * (attempt + 1))
        return this.rpc<T>(method, params, attempt + 1)
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }

  async fetchRecentSignatures(address: string, limit = 100): Promise<SignatureInfo[]> {
    const args = [
      address,
      {
        limit,
        commitment: this.commitment,
      },
    ]
    const result = await this.rpc<SignatureInfo[]>("getSignaturesForAddress", args)
    // keep only successful transactions
    return result.filter((s) => s.err === null)
  }

  private async fetchTransaction(signature: string): Promise<TransactionResult | null> {
    const args = [
      signature,
      {
        commitment: this.commitment,
        maxSupportedTransactionVersion: 0,
      },
    ]
    try {
      return await this.rpc<TransactionResult>("getTransaction", args)
    } catch {
      return null
    }
  }

  /**
   * Analyze activity for a specific SPL mint by comparing pre/post token balances.
   */
  async analyzeActivity(mint: string, limit = 50): Promise<ActivityRecord[]> {
    const sigInfos = await this.fetchRecentSignatures(mint, limit)
    const records: ActivityRecord[] = []

    for (const { signature, blockTime } of sigInfos) {
      const tx = await this.fetchTransaction(signature)
      const meta = tx?.meta
      if (!meta) continue

      const pre = (meta.preTokenBalances ?? []).filter((b) => b.mint === mint)
      const post = (meta.postTokenBalances ?? []).filter((b) => b.mint === mint)

      // Index by owner for simple delta comparison
      const byOwner = new Map<string, { pre?: TokenBalanceEntry; post?: TokenBalanceEntry }>()
      for (const e of pre) {
        const owner = e.owner ?? "unknown"
        byOwner.set(owner, { ...(byOwner.get(owner) ?? {}), pre: e })
      }
      for (const e of post) {
        const owner = e.owner ?? "unknown"
        byOwner.set(owner, { ...(byOwner.get(owner) ?? {}), post: e })
      }

      for (const [owner, pair] of byOwner.entries()) {
        const preAmt = toBigInt(pair.pre?.uiTokenAmount.amount)
        const postAmt = toBigInt(pair.post?.uiTokenAmount.amount)
        const decimals =
          pair.post?.uiTokenAmount.decimals ??
          pair.pre?.uiTokenAmount.decimals ??
          0
        const delta = postAmt - preAmt
        if (delta === 0n) continue

        const amountUi = Number(delta) / 10 ** decimals
        const src = delta > 0n ? "unknown" : owner
        const dst = delta > 0n ? owner : "unknown"

        records.push({
          timestamp: (blockTime ?? 0) * 1000,
          signature,
          source: src,
          destination: dst,
          amount: Math.abs(amountUi),
        })
      }
    }

    // newest first
    records.sort((a, b) => b.timestamp - a.timestamp || a.signature.localeCompare(b.signature))
    return records
  }
}

function toBigInt(amount?: string): bigint {
  if (!amount) return 0n
  try {
    return BigInt(amount)
  } catch {
    return 0n
  }
}
