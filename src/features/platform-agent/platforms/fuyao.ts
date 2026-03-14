/**
 * Fuyao platform adapter. MOCK: list/detail/publish all from mock data or mock success.
 * Replace with real HTTP when API is available.
 */

import type {
  IPlatformAdapter,
  PlatformAgentApp,
  GetAgentListOptions,
  GetAgentDetailOptions,
  PublishResult,
  InvokePlatformToolOptions,
  InvokePlatformToolResult,
} from "../types"
import { MOCK_FUYAO_AGENTS } from "../mock-data"

export const fuyaoAdapter: IPlatformAdapter = {
  async getAgentList(_options?: GetAgentListOptions): Promise<PlatformAgentApp[]> {
    return [...MOCK_FUYAO_AGENTS]
  },
  async getAgentDetail(options: GetAgentDetailOptions): Promise<PlatformAgentApp | null> {
    if (options.id) return MOCK_FUYAO_AGENTS.find((a) => a.id === options.id) ?? null
    if (options.name) {
      return (
        MOCK_FUYAO_AGENTS.find(
          (a) =>
            a.name === options.name &&
            (options.version == null || a.version === options.version)
        ) ?? null
      )
    }
    return null
  },
  async publishAgent(app: PlatformAgentApp): Promise<PublishResult> {
    return { version: app.version ?? "1.0.0" }
  },
  async invokeTool(options: InvokePlatformToolOptions): Promise<InvokePlatformToolResult> {
    return {
      success: true,
      output: `[Fuyao mock] Invoked tool ${options.toolId} (${options.toolType}) for agent ${options.agentName}. Arguments: ${JSON.stringify(options.arguments ?? {})}`,
    }
  },
}
