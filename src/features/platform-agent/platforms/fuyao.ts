/**
 * Fuyao platform adapter. Stage one: returns mock list only.
 * Replace getAgentList implementation with real HTTP when API is available.
 */

import type { IPlatformAdapter, PlatformAgentApp, GetAgentListOptions } from "../types"
import { MOCK_FUYAO_AGENTS } from "../mock-data"

export const fuyaoAdapter: IPlatformAdapter = {
  async getAgentList(_options?: GetAgentListOptions): Promise<PlatformAgentApp[]> {
    // TODO: replace with real Fuyao list API
    return [...MOCK_FUYAO_AGENTS]
  },
}
