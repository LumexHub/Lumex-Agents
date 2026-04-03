import type { TokenDataPoint } from "./token_data_fetcher"

export interface DataIframeConfig {
  containerId: string
  iframeUrl: string
  token: string
  /**
   * Polling interval for pushing updates to the iframe
   */
  refreshMs?: number
  /**
   * Optional explicit postMessage target origin
   * Defaults to the origin parsed from iframeUrl
   */
  targetOrigin?: string
  /**
   * Optional API base for fetching token history
   * Defaults to iframeUrl (not ideal, but kept for compatibility)
   */
  apiBase?: string
}

type CleanupFn = () => void

export class TokenDataIframeEmbedder {
  private iframe?: HTMLIFrameElement
  private refreshTimer?: number
  private destroyers: CleanupFn[] = []

  constructor(private cfg: DataIframeConfig) {}

  /**
   * Initialize the iframe and start periodic updates (if refreshMs provided)
   */
  async init(): Promise<void> {
    const container = document.getElementById(this.cfg.containerId)
    if (!container) throw new Error(`Container not found: ${this.cfg.containerId}`)

    this.iframe = document.createElement("iframe")
    this.iframe.src = this.cfg.iframeUrl
    this.iframe.style.border = "none"
    this.iframe.width = "100%"
    this.iframe.height = "100%"
    this.iframe.onload = () => this.postTokenData().catch(() => void 0)
    container.appendChild(this.iframe)

    // Visibility-based throttling: pause while tab is hidden, resume when visible
    const onVisibility = () => {
      if (document.hidden) {
        this.stop()
      } else if (this.cfg.refreshMs) {
        this.start()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    this.destroyers.push(() => document.removeEventListener("visibilitychange", onVisibility))

    if (this.cfg.refreshMs) {
      this.start()
    }
  }

  /**
   * Begin periodic postMessage updates
   */
  start(): void {
    if (!this.cfg.refreshMs || this.refreshTimer) return
    // Fire immediately, then at interval
    this.postTokenData().catch(() => void 0)
    this.refreshTimer = window.setInterval(
      () => this.postTokenData().catch(() => void 0),
      this.cfg.refreshMs
    )
  }

  /**
   * Stop periodic updates
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
  }

  /**
   * Update the observed token and push a fresh snapshot
   */
  async updateToken(nextToken: string): Promise<void> {
    this.cfg.token = nextToken
    await this.postTokenData()
  }

  /**
   * Update iframe URL and reload
   */
  async updateIframeUrl(nextUrl: string): Promise<void> {
    this.cfg.iframeUrl = nextUrl
    if (this.iframe) {
      this.iframe.src = nextUrl
    }
    await this.postTokenData()
  }

  /**
   * Push latest token data to the iframe via postMessage
   */
  private async postTokenData(): Promise<void> {
    if (!this.iframe?.contentWindow) return

    const fetcherModule = await import("./token_data_fetcher")
    const apiBase = this.cfg.apiBase ?? this.cfg.iframeUrl
    const fetcher = new fetcherModule.TokenDataFetcher(apiBase)

    // Support both return shapes: direct array OR { success, data }
    let data: TokenDataPoint[] = []
    try {
      const maybe = await (fetcher as any).fetchHistory(this.cfg.token)
      if (Array.isArray(maybe)) {
        data = maybe
      } else if (maybe && typeof maybe === "object") {
        if (maybe.success && Array.isArray(maybe.data)) {
          data = maybe.data
        } else {
          // unsuccessful structured result
          data = []
        }
      }
    } catch {
      // swallow fetch errors; downstream can handle empty data
      data = []
    }

    const message = {
      type: "TOKEN_DATA_UPDATE",
      token: this.cfg.token,
      data,
      ts: Date.now(),
    }

    this.iframe.contentWindow.postMessage(message, this.computeTargetOrigin())
  }

  /**
   * Compute safe target origin for postMessage
   */
  private computeTargetOrigin(): string {
    if (this.cfg.targetOrigin) return this.cfg.targetOrigin
    try {
      const u = new URL(this.cfg.iframeUrl, window.location.href)
      return u.origin
    } catch {
      // Fallback when URL parsing fails
      return "*"
    }
  }

  /**
   * Remove iframe, timers, and listeners
   */
  destroy(): void {
    this.stop()
    this.destroyers.forEach((fn) => fn())
    this.destroyers = []
    if (this.iframe?.parentElement) {
      this.iframe.parentElement.removeChild(this.iframe)
    }
    this.iframe = undefined
  }
}
