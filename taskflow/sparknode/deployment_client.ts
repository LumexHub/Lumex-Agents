export interface LaunchConfig {
  contractName: string
  parameters: Record<string, any>
  deployEndpoint: string
  apiKey?: string
  timeoutMs?: number
  retries?: number
}

export interface LaunchResult {
  success: boolean
  address?: string
  transactionHash?: string
  error?: string
  elapsedMs?: number
}

export class LaunchNode {
  private timeoutMs: number
  private retries: number

  constructor(private config: LaunchConfig) {
    this.timeoutMs = config.timeoutMs ?? 10_000
    this.retries = Math.max(0, config.retries ?? 1)
  }

  async deploy(): Promise<LaunchResult> {
    const { deployEndpoint, apiKey, contractName, parameters } = this.config
    const start = performance.now()

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const res = await fetch(deployEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ contractName, parameters }),
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (!res.ok) {
          const text = await res.text()
          if (attempt < this.retries) {
            await this.sleep(200 * (attempt + 1))
            continue
          }
          return {
            success: false,
            error: `HTTP ${res.status}: ${text}`,
            elapsedMs: Math.round(performance.now() - start),
          }
        }

        const json = await res.json()
        return {
          success: true,
          address: json.contractAddress,
          transactionHash: json.txHash,
          elapsedMs: Math.round(performance.now() - start),
        }
      } catch (err: any) {
        clearTimeout(timer)
        if (attempt < this.retries) {
          await this.sleep(200 * (attempt + 1))
          continue
        }
        return {
          success: false,
          error: err?.message ?? "Unknown error",
          elapsedMs: Math.round(performance.now() - start),
        }
      }
    }

    return {
      success: false,
      error: "Deployment failed after retries",
      elapsedMs: Math.round(performance.now() - start),
    }
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }
}
