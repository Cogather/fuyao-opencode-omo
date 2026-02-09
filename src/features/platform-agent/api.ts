/**
 * Platform agent API. getPlatformAgentList delegates to adapter (mock or real).
 */

import type { PlatformType, PlatformAgentApp, GetAgentListOptions } from "./types"
import { getPlatformAdapter } from "./platforms"

export async function getPlatformAgentList(
  platformType: PlatformType,
  options?: GetAgentListOptions
): Promise<PlatformAgentApp[]> {
  const adapter = getPlatformAdapter(platformType)
  return adapter.getAgentList(options)
}
