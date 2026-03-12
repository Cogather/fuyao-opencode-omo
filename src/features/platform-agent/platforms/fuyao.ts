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
}
