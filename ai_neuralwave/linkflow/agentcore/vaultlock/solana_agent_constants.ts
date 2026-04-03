/**
 * Constant identifier for the Solana Knowledge Agent
 */
export const SOLANA_KNOWLEDGE_AGENT_ID = "solana-knowledge-agent" as const

/**
 * Utility to verify if a given agent id matches the Solana Knowledge Agent
 */
export function isSolanaKnowledgeAgent(id: string): boolean {
  return id === SOLANA_KNOWLEDGE_AGENT_ID
}

/**
 * Registry entry structure for agents
 */
export interface AgentRegistryEntry {
  id: string
  description: string
  version: string
  enabled: boolean
}

/**
 * Default registry entry for the Solana Knowledge Agent
 */
export const SOLANA_KNOWLEDGE_AGENT_ENTRY: AgentRegistryEntry = {
  id: SOLANA_KNOWLEDGE_AGENT_ID,
  description:
    "Agent specialized in Solana ecosystem knowledge: protocols, tokens, validators, staking, developer tools, and RPCs.",
  version: "1.0.0",
  enabled: true,
}
