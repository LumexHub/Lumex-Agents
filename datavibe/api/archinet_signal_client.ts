export interface Signal {
  id: string
  type: string
  timestamp: number
  payload: Record<string, any>
  source?: string
  severity?: "low" | "medium" | "high" | "critical"
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
}

/**
 * Simple HTTP client for fetching and managing signals from ArchiNet.
 */
export class SignalApiClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`
    return headers
  }

  private async handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
    if (!res.ok) {
      return { success: false, error: res.statusText, statusCode: res.status }
    }
    try {
      const data = (await res.json()) as T
      return { success: true, data, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err.message, statusCode: res.status }
    }
  }

  async fetchAllSignals(): Promise<ApiResponse<Signal[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/signals`, {
        method: "GET",
        headers: this.getHeaders(),
      })
      return this.handleResponse<Signal[]>(res)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async fetchSignalById(id: string): Promise<ApiResponse<Signal>> {
    try {
      const res = await fetch(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: this.getHeaders(),
      })
      return this.handleResponse<Signal>(res)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async createSignal(signal: Omit<Signal, "id" | "timestamp">): Promise<ApiResponse<Signal>> {
    try {
      const res = await fetch(`${this.baseUrl}/signals`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ ...signal, timestamp: Date.now() }),
      })
      return this.handleResponse<Signal>(res)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async deleteSignal(id: string): Promise<ApiResponse<null>> {
    try {
      const res = await fetch(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      })
      if (res.ok) return { success: true, data: null, statusCode: res.status }
      return { success: false, error: res.statusText, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
