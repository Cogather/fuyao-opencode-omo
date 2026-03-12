/**
 * Platform agent API. getPlatformAgentList delegates to adapter (mock or real).
 * publishPlatformAgent calls adapter.publishAgent when present, otherwise mocks success.
 */

import type { PlatformType, PlatformAgentApp, GetAgentListOptions, PublishResult } from "./types"
import { getPlatformAdapter } from "./platforms"

export async function getPlatformAgentList(
  platformType: PlatformType,
  options?: GetAgentListOptions
): Promise<PlatformAgentApp[]> {
  const adapter = getPlatformAdapter(platformType)
  return adapter.getAgentList(options)
}

/**
 * Publish/update an agent app on the platform. Uses adapter.publishAgent when implemented;
 * otherwise mocks success (e.g. stage one with mock adapters).
 */
export async function publishPlatformAgent(
  platformType: PlatformType,
  app: PlatformAgentApp
): Promise<PublishResult> {
  const adapter = getPlatformAdapter(platformType)
  if (typeof adapter.publishAgent === "function") {
    return adapter.publishAgent(app)
  }
  return Promise.resolve({ version: app.version ?? "1.0.0" })
}
