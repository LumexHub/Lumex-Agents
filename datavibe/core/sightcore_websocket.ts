export interface SightCoreConfig {
  url: string
  protocols?: string[]
  reconnectIntervalMs?: number
  maxReconnectAttempts?: number
}

export type SightCoreMessage = {
  topic: string
  payload: any
  timestamp: number
}

export class SightCoreWebSocket {
  private socket?: WebSocket
  private url: string
  private protocols?: string[]
  private reconnectInterval: number
  private reconnectAttempts = 0
  private maxReconnectAttempts: number

  constructor(config: SightCoreConfig) {
    this.url = config.url
    this.protocols = config.protocols
    this.reconnectInterval = config.reconnectIntervalMs ?? 5000
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? Infinity
  }

  connect(
    onMessage: (msg: SightCoreMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (err: Event) => void
  ): void {
    this.socket = this.protocols
      ? new WebSocket(this.url, this.protocols)
      : new WebSocket(this.url)

    this.socket.onopen = () => {
      this.reconnectAttempts = 0
      onOpen?.()
    }

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as SightCoreMessage
        if (msg && msg.topic && msg.timestamp) {
          onMessage(msg)
        }
      } catch {
        // ignore invalid messages
      }
    }

    this.socket.onclose = () => {
      onClose?.()
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(
          () => this.connect(onMessage, onOpen, onClose, onError),
          this.reconnectInterval
        )
      }
    }

    this.socket.onerror = (err) => {
      onError?.(err)
      this.socket?.close()
    }
  }

  send(topic: string, payload: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ topic, payload, timestamp: Date.now() })
      this.socket.send(msg)
    }
  }

  disconnect(code?: number, reason?: string): void {
    this.socket?.close(code, reason)
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }
}
