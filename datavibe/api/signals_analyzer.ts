import type { Signal } from "./signal_api_client"

/**
 * Processes raw signals into actionable events with filtering, aggregation, and summarization.
 */
export class SignalProcessor {
  /**
   * Filter signals by type and recency.
   * @param signals Array of Signal
   * @param type Desired signal type
   * @param sinceTimestamp Only include signals after this time
   */
  filter(signals: Signal[], type: string, sinceTimestamp: number): Signal[] {
    return signals.filter((s) => s.type === type && s.timestamp > sinceTimestamp)
  }

  /**
   * Aggregate signals by type, counting occurrences.
   * @param signals Array of Signal
   */
  aggregateByType(signals: Signal[]): Record<string, number> {
    return signals.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Aggregate signals by source field (if present).
   */
  aggregateBySource(signals: Signal[]): Record<string, number> {
    return signals.reduce((acc, s) => {
      const src = s.source ?? "unknown"
      acc[src] = (acc[src] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Transform a signal into a human-readable summary string.
   */
  summarize(signal: Signal): string {
    const time = new Date(signal.timestamp).toISOString()
    const severity = signal.severity ? `[${signal.severity.toUpperCase()}]` : ""
    return `${severity}[${time}] ${signal.type.toUpperCase()}: ${JSON.stringify(signal.payload)}`
  }

  /**
   * Return only the latest N signals, sorted by timestamp.
   */
  latest(signals: Signal[], count: number): Signal[] {
    return [...signals].sort((a, b) => b.timestamp - a.timestamp).slice(0, count)
  }

  /**
   * Detect whether a burst of signals occurred in a short timeframe.
   */
  detectBurst(signals: Signal[], windowMs: number, minCount: number): boolean {
    if (signals.length < minCount) return false
    const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp)
    for (let i = 0; i <= sorted.length - minCount; i++) {
      const start = sorted[i].timestamp
      const end = sorted[i + minCount - 1].timestamp
      if (end - start <= windowMs) return true
    }
    return false
  }
}
