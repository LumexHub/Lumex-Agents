/**
 * Simple task executor: registers and runs tasks by name.
 */
type Handler = (params: any) => Promise<any>

interface QueuedTask {
  id: string
  type: string
  params: any
  enqueuedAt: number
  attempts: number
}

interface ExecutionResult {
  id: string
  result?: any
  error?: string
  executedAt: number
  attempts: number
}

export class ExecutionEngine {
  private handlers: Record<string, Handler> = {}
  private queue: QueuedTask[] = []
  private defaultMaxRetries = 1

  /**
   * Register a handler for a specific task type.
   */
  register(type: string, handler: Handler): void {
    if (!type || typeof handler !== "function") {
      throw new Error("Invalid handler registration")
    }
    this.handlers[type] = handler
  }

  /**
   * Enqueue a task for execution.
   */
  enqueue(id: string, type: string, params: any, maxRetries = this.defaultMaxRetries): void {
    if (!this.handlers[type]) {
      throw new Error(`No handler registered for task type "${type}"`)
    }
    this.queue.push({
      id,
      type,
      params,
      enqueuedAt: Date.now(),
      attempts: 0,
    })
  }

  /**
   * Run all queued tasks in FIFO order.
   */
  async runAll(): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = []

    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      const handler = this.handlers[task.type]
      let success = false

      while (!success && task.attempts <= this.defaultMaxRetries) {
        task.attempts++
        try {
          const data = await handler(task.params)
          results.push({
            id: task.id,
            result: data,
            executedAt: Date.now(),
            attempts: task.attempts,
          })
          success = true
        } catch (err: any) {
          if (task.attempts > this.defaultMaxRetries) {
            results.push({
              id: task.id,
              error: err?.message ?? "Unknown error",
              executedAt: Date.now(),
              attempts: task.attempts,
            })
          }
        }
      }
    }

    return results
  }

  /**
   * Return a snapshot of the current queue.
   */
  inspectQueue(): QueuedTask[] {
    return [...this.queue]
  }

  /**
   * Clear the queue without executing tasks.
   */
  clearQueue(): void {
    this.queue = []
  }
}
