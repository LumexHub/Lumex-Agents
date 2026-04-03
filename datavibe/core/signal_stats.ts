import type { SightCoreMessage } from "./websocket_client"

export interface AggregatedSignal {
  topic: string
  count: number
  lastPayload: any
  lastTimestamp: number
  firstTimestamp?: number
}

export class SignalAggregator {
  private counts: Record<string, AggregatedSignal> = {}

  /**
   * Process an incoming message and update aggregation.
   */
  processMessage(msg: SightCoreMessage): AggregatedSignal {
    const { topic, payload, timestamp } = msg
    const entry: AggregatedSignal = this.counts[topic] || {
      topic,
      count: 0,
      lastPayload: null,
      lastTimestamp: 0,
      firstTimestamp: timestamp,
    }
    entry.count += 1
    entry.lastPayload = payload
    entry.lastTimestamp = timestamp
    this.counts[topic] = entry
    return entry
  }

  /**
   * Retrieve aggregated info for a single topic.
   */
  getAggregated(topic: string): AggregatedSignal | undefined {
    return this.counts[topic]
  }

  /**
   * Retrieve all aggregated results.
   */
  getAllAggregated(): AggregatedSignal[] {
    return Object.values(this.counts)
  }

  /**
   * Get the most active topics, sorted by count.
   */
  getTopTopics(limit = 5): AggregatedSignal[] {
    return Object.values(this.counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Reset all aggregation state.
   */
  reset(): void {
    this.counts = {}
  }

  /**
   * Clear a single topic’s aggregation.
   */
  clearTopic(topic: string): void {
    delete this.counts[topic]
  }
}
