import { toolkitBuilder } from "@/ai/core"
import { FETCH_POOL_DATA_KEY } from "@/ai/modules/liquidity/pool-fetcher/key"
import { ANALYZE_POOL_HEALTH_KEY } from "@/ai/modules/liquidity/health-checker/key"
import { FetchPoolDataAction } from "@/ai/modules/liquidity/pool-fetcher/action"
import { AnalyzePoolHealthAction } from "@/ai/modules/liquidity/health-checker/action"

type Toolkit = ReturnType<typeof toolkitBuilder>

/**
 * Toolkit exposing liquidity-related actions:
 * – fetch raw pool data
 * – run health / risk analysis on a liquidity pool
 * – additional aggregation helpers
 */
export const LIQUIDITY_ANALYSIS_TOOLS: Record<string, Toolkit> = Object.freeze({
  [`liquidityscan-${FETCH_POOL_DATA_KEY}`]: toolkitBuilder(new FetchPoolDataAction()),
  [`poolhealth-${ANALYZE_POOL_HEALTH_KEY}`]: toolkitBuilder(new AnalyzePoolHealthAction()),
})

/**
 * Helper to list available liquidity tool keys
 */
export function listLiquidityTools(): string[] {
  return Object.keys(LIQUIDITY_ANALYSIS_TOOLS)
}

/**
 * Helper to run a specific tool if available
 */
export async function runLiquidityTool(key: string, input: unknown): Promise<unknown> {
  const tool = LIQUIDITY_ANALYSIS_TOOLS[key]
  if (!tool) throw new Error(`Liquidity tool not found: ${key}`)
  if (typeof tool.run !== "function") throw new Error(`Liquidity tool ${key} is not executable`)
  return await tool.run(input)
}

/**
 * Merge two toolkits into one
 */
export function mergeLiquidityToolkits(
  extra: Record<string, Toolkit>
): Record<string, Toolkit> {
  return Object.freeze({ ...LIQUIDITY_ANALYSIS_TOOLS, ...extra })
}
