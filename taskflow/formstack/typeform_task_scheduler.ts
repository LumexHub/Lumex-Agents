import type { TaskFormInput } from "./taskFormSchemas"
import { TaskFormSchema } from "./taskFormSchemas"

/**
 * Scheduled task representation used by downstream systems.
 */
interface ScheduledTask {
  id: string
  name: string
  type: string
  parameters: Record<string, unknown>
  cron: string
  createdAt: string
}

/**
 * Very lightweight cron validator (5 fields: m h dom mon dow).
 * Accepts "*", numbers, ranges, lists, and steps (e.g., "*/5").
 * This is not a full cron parser, but catches common mistakes.
 */
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const fieldRe = /^(\*|\d+|\d+-\d+)(\/\d+)?(,(\*|\d+|\d+-\d+)(\/\d+)?)*$/
  // minute 0-59, hour 0-23, dom 1-31, month 1-12, dow 0-7
  const ranges: Array<[number, number]> = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ]
  for (let i = 0; i < 5; i++) {
    const f = parts[i]
    if (!fieldRe.test(f)) return false
    // Rough numeric bound checks
    const nums = f
      .split(",")
      .flatMap(seg => seg.replace(/^\*$/, "").split(/[/-]/))
      .filter(Boolean)
      .map(n => Number(n))
    if (nums.some(n => Number.isNaN(n))) return false
    if (nums.some(n => n < ranges[i][0] || n > ranges[i][1])) return false
  }
  return true
}

/**
 * Generate a stable-ish ID; prefers crypto.randomUUID when available.
 */
function generateId(prefix = "task"): string {
  const hasCrypto =
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).crypto !== "undefined" &&
    typeof (globalThis as any).crypto.randomUUID === "function"
  const core = hasCrypto
    ? (globalThis as any).crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}_${core}`
}

/**
 * Normalize parameters to a plain object to avoid prototype pollution and ensure serializability.
 */
function normalizeParameters(params: TaskFormInput["parameters"]): Record<string, unknown> {
  if (!params || typeof params !== "object") return {}
  return JSON.parse(JSON.stringify(params))
}

/**
 * Processes a Typeform webhook payload to schedule a new task.
 */
export async function handleTypeformSubmission(
  raw: unknown
): Promise<{ success: boolean; message: string }> {
  const parsed = TaskFormSchema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.issues.map(i => i.message).join("; ")
    return { success: false, message: `Validation error: ${details}` }
  }

  const { taskName, taskType, parameters, scheduleCron } = parsed.data

  // Basic cron sanity check
  if (!isValidCron(scheduleCron)) {
    return { success: false, message: `Invalid cron expression: "${scheduleCron}"` }
  }

  // Construct the scheduled task payload
  const task: ScheduledTask = {
    id: generateId("job"),
    name: taskName.trim(),
    type: taskType,
    parameters: normalizeParameters(parameters),
    cron: scheduleCron.trim(),
    createdAt: new Date().toISOString(),
  }

  // TODO: Integrate with your real scheduler/queue/broker here.
  // For now, we simply simulate persistence.
  try {
    // Example: await scheduler.enqueue(task)
    void task // noop to satisfy linter in this stub
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to schedule task "${taskName}": ${err?.message ?? "unknown error"}`,
    }
  }

  return {
    success: true,
    message: `Task "${task.name}" scheduled with ID ${task.id}`,
  }
}
