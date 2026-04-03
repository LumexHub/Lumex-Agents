// Orchestrated analysis + report + signature verification with basic safeguards

// Assumes these are available in your project:
// import { TokenActivityAnalyzer } from "./token_activity_analyzer"
// import { TokenDepthAnalyzer } from "./token_depth_analyzer"
// import { detectVolumePatterns } from "./volume_pattern_detector"
// import { ExecutionEngine } from "./execution_engine"
// import { SigningEngine } from "./signing_engine"

type AnyRecord = Record<string, any>

function nowIso() {
  return new Date().toISOString()
}

async function timeIt<T>(label: string, fn: () => Promise<T>): Promise<{ data: T; ms: number }> {
  const start = performance.now()
  const data = await fn()
  return { data, ms: Math.round(performance.now() - start) }
}

function nonNegative(n: number): number {
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function normalizeVolumes(records: Array<{ amount: number }>): number[] {
  // Guard against NaN/negative values and empty sets
  const vols = records.map(r => nonNegative(r.amount))
  if (vols.length === 0) return []
  // Small smoothing to reduce noise (median of 3)
  const out: number[] = []
  for (let i = 0; i < vols.length; i++) {
    const a = vols[i - 1] ?? vols[i]
    const b = vols[i]
    const c = vols[i + 1] ?? vols[i]
    out.push([a, b, c].sort((x, y) => x - y)[1])
  }
  return out
}

function summarize<T extends AnyRecord>(arr: T[], pick: (x: T) => number): { min: number; max: number; avg: number } {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0 }
  let min = Infinity, max = -Infinity, sum = 0
  for (const x of arr) {
    const v = pick(x)
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { min, max, avg: sum / arr.length }
}

(async () => {
  try {
    // ---- 1) Analyze activity ----
    const activityAnalyzer = new TokenActivityAnalyzer("https://solana.rpc")
    const { data: records, ms: activityMs } = await timeIt("activity", () =>
      activityAnalyzer.analyzeActivity("MintPubkeyHere", 20)
    )

    // ---- 2) Analyze orderbook depth ----
    const depthAnalyzer = new TokenDepthAnalyzer("https://dex.api", "MarketPubkeyHere")
    const { data: depthMetrics, ms: depthMs } = await timeIt("depth", () =>
      depthAnalyzer.analyze(30)
    )

    // ---- 3) Detect volume patterns ----
    const volumes = normalizeVolumes(records)
    // Choose window heuristically based on sample size
    const window = Math.min(10, Math.max(3, Math.floor(volumes.length / 6) || 5))
    // Threshold heuristic: 75th percentile of volumes or a fixed floor
    let threshold = 100
    if (volumes.length > 0) {
      const sorted = [...volumes].sort((a, b) => a - b)
      const p75 = sorted[Math.floor(0.75 * (sorted.length - 1))]
      threshold = Math.max(100, p75)
    }
    const patterns = detectVolumePatterns(volumes, window, threshold)

    // ---- 4) Execute a custom task (report summary) ----
    const engine = new ExecutionEngine()
    engine.register("report", async (params: { records: AnyRecord[]; depth: AnyRecord; patterns: AnyRecord[] }) => {
      const recSummary = summarize(params.records, (r) => r.amount ?? 0)
      return {
        recordsCount: params.records.length,
        volume: recSummary,
        spread: (params.depth?.spread ?? 0),
        avgBidDepth: (params.depth?.averageBidDepth ?? 0),
        avgAskDepth: (params.depth?.averageAskDepth ?? 0),
        patternsCount: params.patterns.length,
        generatedAt: nowIso(),
      }
    })
    engine.enqueue("task1", "report", { records, depth: depthMetrics, patterns })
    const taskResults = await engine.runAll()

    // ---- 5) Sign and verify the results ----
    const signer = new SigningEngine()
    const payload = JSON.stringify(
      {
        meta: { activityMs, depthMs, createdAt: nowIso() },
        depthMetrics,
        patterns,
        taskResults,
      },
      null,
      2
    )
    const signature = await signer.sign(payload)
    const ok = await signer.verify(payload, signature)

    // ---- Output ----
    console.log(
      JSON.stringify(
        {
          meta: { activityMs, depthMs },
          recordsCount: records.length,
          depthMetrics,
          patternsCount: patterns.length,
          taskResults,
          signatureValid: ok,
        },
        null,
        2
      )
    )
  } catch (err: any) {
    console.error("Pipeline failed:", err?.message ?? err)
    process.exitCode = 1
  }
})()
