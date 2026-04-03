import type { TokenMetrics } from "./token_analysis_calculator"

export interface IframeConfig {
  containerId: string
  srcUrl: string
  metrics: TokenMetrics
  refreshIntervalMs?: number
  /**
   * If provided, used as the postMessage target origin.
   * Otherwise derived from srcUrl; falls back to "*" on parse error.
   */
  targetOrigin?: string
  /**
   * Enable console logs from this class
   */
  debug?: boolean
}

type Cleanup = () => void

export class TokenAnalysisIframe {
  private iframeEl: HTMLIFrameElement | null = null
  private timerId?: number
  private destroyers: Cleanup[] = []
  private ready = false
  private lastPostedAt = 0

  constructor(private config: IframeConfig) {}

  init(): void {
    const container = document.getElementById(this.config.containerId)
    if (!container) throw new Error("Container not found: " + this.config.containerId)

    const iframe = document.createElement("iframe")
    iframe.src = this.config.srcUrl
    iframe.width = "100%"
    iframe.height = "100%"
    iframe.style.border = "none"
    iframe.onload = () => {
      this.ready = true
      this.postMetricsSafe()
    }
    container.appendChild(iframe)
    this.iframeEl = iframe

    // Listen for a simple "ready" signal from the iframe (optional)
    const onMessage = (evt: MessageEvent) => {
      if (typeof evt.data !== "object" || !evt.data) return
      if (evt.data.type === "TOKEN_ANALYSIS_READY") {
        this.ready = true
        this.postMetricsSafe()
      }
    }
    window.addEventListener("message", onMessage)
    this.destroyers.push(() => window.removeEventListener("message", onMessage))

    // Pause updates when tab is hidden to save resources
    const onVisibility = () => {
      if (document.hidden) {
        this.stop()
      } else if (this.config.refreshIntervalMs) {
        this.start()
        this.postMetricsSafe()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    this.destroyers.push(() => document.removeEventListener("visibilitychange", onVisibility))

    // Kick off periodic posting, if configured
    if (this.config.refreshIntervalMs) {
      this.start()
    } else {
      // Post once after mount
      this.postMetricsSafe()
    }
  }

  /**
   * Begin periodic updates
   */
  start(): void {
    if (!this.config.refreshIntervalMs || this.timerId) return
    // fire immediately, then interval
    this.postMetricsSafe()
    this.timerId = window.setInterval(
      () => this.postMetricsSafe(),
      this.config.refreshIntervalMs
    )
  }

  /**
   * Stop periodic updates
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = undefined
    }
  }

  /**
   * Replace the metrics payload and push an immediate update
   */
  updateMetrics(metrics: TokenMetrics): void {
    this.config.metrics = metrics
    this.postMetricsSafe()
  }

  /**
   * Update iframe URL, reload, and reset readiness
   */
  updateSrcUrl(nextUrl: string): void {
    this.config.srcUrl = nextUrl
    this.ready = false
    if (this.iframeEl) {
      this.iframeEl.src = nextUrl
    }
  }

  /**
   * Remove iframe and listeners
   */
  destroy(): void {
    this.stop()
    this.destroyers.forEach((f) => f())
    this.destroyers = []
    if (this.iframeEl?.parentElement) {
      this.iframeEl.parentElement.removeChild(this.iframeEl)
    }
    this.iframeEl = null
  }

  // ---------- internals ----------

  private postMetricsSafe(): void {
    if (!this.iframeEl?.contentWindow) return
    if (!this.ready) {
      // still attempt to post (in case target does not send READY messages)
      // but throttle to avoid spamming before onload
      if (Date.now() - this.lastPostedAt < 500) return
    }

    // Basic shape validation to avoid posting malformed payloads
    const m = this.config.metrics
    if (!m || !this.isFiniteNumber(m.averagePrice) || !this.isFiniteNumber(m.volatility)) {
      this.debugLog("Skip post: metrics missing or invalid")
      return
    }

    const message = {
      type: "TOKEN_ANALYSIS_METRICS",
      payload: this.config.metrics,
      ts: Date.now(),
    }

    this.iframeEl.contentWindow.postMessage(message, this.computeTargetOrigin())
    this.lastPostedAt = Date.now()
    this.debugLog("Posted metrics to iframe", message)
  }

  private computeTargetOrigin(): string {
    if (this.config.targetOrigin) return this.config.targetOrigin
    try {
      const u = new URL(this.config.srcUrl, window.location.href)
      return u.origin
    } catch {
      return "*"
    }
  }

  private isFiniteNumber(x: unknown): x is number {
    return typeof x === "number" && Number.isFinite(x)
  }

  private debugLog(...args: unknown[]) {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log("[TokenAnalysisIframe]", ...args)
    }
  }
}
