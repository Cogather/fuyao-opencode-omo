/**
 * AgentCenter platform adapter. Stage one: returns mock list only.
 * Replace getAgentList implementation with real HTTP when API is available.
 */

import type { IPlatformAdapter, PlatformAgentApp, GetAgentListOptions } from "../types"
import { MOCK_AGENTCENTER_AGENTS } from "../mock-data"

export const agentcenterAdapter: IPlatformAdapter = {
  async getAgentList(_options?: GetAgentListOptions): Promise<PlatformAgentApp[]> {
    // TODO: replace with real AgentCenter list API
    return [...MOCK_AGENTCENTER_AGENTS]
  },
}
