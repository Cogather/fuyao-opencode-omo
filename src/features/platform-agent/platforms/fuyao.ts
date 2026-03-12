/**
 * Fuyao platform adapter. Stage one: returns mock list only; publish mocks success.
 * Replace with real HTTP when API is available.
 */

import type { IPlatformAdapter, PlatformAgentApp, GetAgentListOptions, PublishResult } from "../types"
import { MOCK_FUYAO_AGENTS } from "../mock-data"

export const fuyaoAdapter: IPlatformAdapter = {
  async getAgentList(_options?: GetAgentListOptions): Promise<PlatformAgentApp[]> {
    return [...MOCK_FUYAO_AGENTS]
  },
  async publishAgent(app: PlatformAgentApp): Promise<PublishResult> {
    return { version: app.version ?? "1.0.0" }
  },
}
