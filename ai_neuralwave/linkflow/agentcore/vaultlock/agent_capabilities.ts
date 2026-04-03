export interface AgentCapabilities {
  canAnswerProtocolQuestions: boolean
  canAnswerTokenQuestions: boolean
  canDescribeTooling: boolean
  canReportEcosystemNews: boolean
  canProvideRiskAnalysis?: boolean
  canSuggestStrategies?: boolean
}

export interface AgentFlags {
  requiresExactInvocation: boolean
  noAdditionalCommentary: boolean
  experimental?: boolean
  restrictedContexts?: string[]
}

export const SOLANA_AGENT_CAPABILITIES: AgentCapabilities = {
  canAnswerProtocolQuestions: true,
  canAnswerTokenQuestions: true,
  canDescribeTooling: true,
  canReportEcosystemNews: true,
  canProvideRiskAnalysis: true,
  canSuggestStrategies: false,
}

export const SOLANA_AGENT_FLAGS: AgentFlags = {
  requiresExactInvocation: true,
  noAdditionalCommentary: true,
  experimental: false,
  restrictedContexts: ["private", "sensitive"],
}

/**
 * Helper to merge default capabilities with overrides
 */
export function createAgentCapabilities(
  base: AgentCapabilities,
  overrides: Partial<AgentCapabilities>
): AgentCapabilities {
  return { ...base, ...overrides }
}

/**
 * Helper to merge default flags with overrides
 */
export function createAgentFlags(
  base: AgentFlags,
  overrides: Partial<AgentFlags>
): AgentFlags {
  return { ...base, ...overrides }
}
