import { toolkitBuilder } from "@/ai/core"
import { FETCH_POOL_DATA_KEY } from "@/ai/modules/liquidity/pool-fetcher/key"
import { ANALYZE_POOL_HEALTH_KEY } from "@/ai/modules/liquidity/health-checker/key"
import { FetchPoolDataAction } from "@/ai/modules/liquidity/pool-fetcher/action"
import { AnalyzePoolHealthAction } from "@/ai/modules/liquidity/health-checker/action"

type Toolkit = ReturnType<typeof toolkitBuilder>

/**
 * Extended toolkit exposing liquidity-related actions:
 * – fetch raw pool data
 * – run health / risk analysis on a liquidity pool
 * – utilities for inspecting available tools and merging with others
 */
export const EXTENDED_LIQUIDITY_TOOLS: Record<string, Toolkit> = Object.freeze({
  [`liquidityscan-${FETCH_POOL_DATA_KEY}`]: toolkitBuilder(new FetchPoolDataAction()),
  [`poolhealth-${ANALYZE_POOL_HEALTH_KEY}`]: toolkitBuilder(new AnalyzePoolHealthAction()),
})

/**
 * Get all tool keys in this registry
 */
export function listExtendedLiquidityTools(): string[] {
  return Object.keys(EXTENDED_LIQUIDITY_TOOLS)
}

/**
 * Run a tool from this registry if it exists
 */
export async function runExtendedLiquidityTool(key: string, input: unknown): Promise<unknown> {
  const tool = EXTENDED_LIQUIDITY_TOOLS[key]
  if (!tool) throw new Error(`Liquidity tool not found: ${key}`)
  if (typeof tool.run !== "function") throw new Error(`Liquidity tool ${key} is not executable`)
  return await tool.run(input)
}

/**
 * Merge this toolkit with an additional registry
 */
export function mergeExtendedLiquidityToolkits(
  extra: Record<string, Toolkit>
): Record<string, Toolkit> {
  return Object.freeze({ ...EXTENDED_LIQUIDITY_TOOLS, ...extra })
}
