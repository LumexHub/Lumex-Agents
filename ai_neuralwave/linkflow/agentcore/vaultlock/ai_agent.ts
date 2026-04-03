import type { BaseAction, ActionResponse } from "./action_contract"
import { z } from "zod"

interface AgentContext {
  apiEndpoint: string
  apiKey: string
  environment?: "dev" | "staging" | "prod"
}

/**
 * Generic AI Agent: registers and routes calls to actions
 */
export class Agent {
  private actions = new Map<string, BaseAction<any, any, AgentContext>>()

  register<S extends z.ZodObject<any>, R>(
    action: BaseAction<S, R, AgentContext>
  ): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with id "${action.id}" already registered`)
    }
    this.actions.set(action.id, action)
  }

  hasAction(actionId: string): boolean {
    return this.actions.has(actionId)
  }

  listActions(): string[] {
    return Array.from(this.actions.keys())
  }

  async invoke<R>(
    actionId: string,
    payload: unknown,
    ctx: AgentContext
  ): Promise<ActionResponse<R>> {
    const action = this.actions.get(actionId)
    if (!action) {
      throw new Error(`Unknown action "${actionId}"`)
    }

    const parsed = action.input.safeParse(payload)
    if (!parsed.success) {
      return {
        notice: `Invalid payload for action "${actionId}"`,
        data: undefined,
        meta: { validationErrors: parsed.error.flatten() },
      } as ActionResponse<R>
    }

    const start = Date.now()
    const resp = await action.execute({ payload: parsed.data, context: ctx })
    const durationMs = Date.now() - start
    return {
      ...resp,
      meta: { ...(resp.meta ?? {}), durationMs, actionId },
    }
  }
}
