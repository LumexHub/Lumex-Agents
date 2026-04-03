import { execCommand } from "./exec_command"

export interface ShellTask {
  id: string
  command: string
  description?: string
  cwd?: string
  timeoutMs?: number
}

export interface ShellResult {
  taskId: string
  output?: string
  error?: string
  executedAt: number
  durationMs: number
}

export class ShellTaskRunner {
  private tasks: ShellTask[] = []

  /**
   * Schedule a shell task for execution.
   */
  scheduleTask(task: ShellTask): void {
    this.tasks.push(task)
  }

  /**
   * Cancel a scheduled task by id.
   */
  cancelTask(id: string): boolean {
    const before = this.tasks.length
    this.tasks = this.tasks.filter((t) => t.id !== id)
    return this.tasks.length < before
  }

  /**
   * List all scheduled tasks.
   */
  listTasks(): ShellTask[] {
    return [...this.tasks]
  }

  /**
   * Execute all scheduled tasks in sequence.
   */
  async runAll(): Promise<ShellResult[]> {
    const results: ShellResult[] = []
    for (const task of this.tasks) {
      const start = Date.now()
      try {
        const output = await execCommand(task.command, task.timeoutMs, task.cwd)
        results.push({
          taskId: task.id,
          output,
          executedAt: start,
          durationMs: Date.now() - start,
        })
      } catch (err: any) {
        results.push({
          taskId: task.id,
          error: err.message,
          executedAt: start,
          durationMs: Date.now() - start,
        })
      }
    }
    this.tasks = []
    return results
  }

  /**
   * Execute a single task immediately.
   */
  async runTask(task: ShellTask): Promise<ShellResult> {
    const start = Date.now()
    try {
      const output = await execCommand(task.command, task.timeoutMs, task.cwd)
      return {
        taskId: task.id,
        output,
        executedAt: start,
        durationMs: Date.now() - start,
      }
    } catch (err: any) {
      return {
        taskId: task.id,
        error: err.message,
        executedAt: start,
        durationMs: Date.now() - start,
      }
    }
  }
}
