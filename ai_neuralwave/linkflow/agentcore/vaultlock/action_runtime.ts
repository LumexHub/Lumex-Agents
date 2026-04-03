import { z } from "zod"

/**
 * Base types for any action
 * - Removes vendor-specific naming
 * - Adds optional metadata and error type
 * - Adds helpers to define and safely run actions with zod validation
 */

export type ActionSchema = z.ZodObject<z.ZodRawShape>

export interface ActionResponse<T> {
  notice: string
  data?: T
  meta?: {
    durationMs?: number
    [k: string]: unknown
  }
}

export interface ActionError {
  notice: string
  error: true
  details?: unknown
}

/**
 * Generic action contract
 */
export interface BaseAction<S extends ActionSchema, R, Ctx = unknown> {
  id: string
  summary: string
  input: S
  execute(args: {
    payload: z.infer<S>
    context: Ctx
    signal?: AbortSignal
  }): Promise<ActionResponse<R>>
}

/**
 * Helper to define a typed action without extra boilerplate
 */
export function defineAction<S extends ActionSchema, R, Ctx = unknown>(
  action: BaseAction<S, R, Ctx>
): BaseAction<S, R, Ctx> {
  return action
}

/**
 * Type guard to check if an arbitrary value adheres to the BaseAction shape
 */
export function isAction(value: any): value is BaseAction<ActionSchema, unknown, unknown> {
  return (
    value != null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.summary === "string" &&
    value.input &&
    typeof value.input.safeParse === "function" &&
    typeof value.execute === "function"
  )
}

/**
 * Safely run an action:
 * - validates the payload against the action's schema
 * - captures execution errors and returns a typed ActionError
 * - enriches the response with execution duration
 */
export async function runAction<S extends ActionSchema, R, Ctx>(
  action: BaseAction<S, R, Ctx>,
  payload: unknown,
  context: Ctx,
  signal?: AbortSignal
): Promise<ActionResponse<R> | ActionError> {
  const parsed = action.input.safeParse(payload)
  if (!parsed.success) {
    return {
      notice: "Invalid payload for action",
      error: true,
      details: parsed.error.flatten(),
    }
  }

  const started = Date.now()
  try {
    const resp = await action.execute({ payload: parsed.data, context, signal })
    const durationMs = Date.now() - started
    return {
      ...resp,
      meta: { ...(resp.meta ?? {}), durationMs },
    }
  } catch (e) {
    return {
      notice: "Action execution failed",
      error: true,
      details:
        e instanceof Error ? { message: e.message, stack: e.stack } : e,
    }
  }
}
