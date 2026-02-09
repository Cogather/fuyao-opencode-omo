import type { PlatformType } from "../types"
import type { IPlatformAdapter } from "../types"
import { fuyaoAdapter } from "./fuyao"
import { agentcenterAdapter } from "./agentcenter"

const adapters: Record<PlatformType, IPlatformAdapter> = {
  fuyao: fuyaoAdapter,
  agentcenter: agentcenterAdapter,
}

export function getPlatformAdapter(platformType: PlatformType): IPlatformAdapter {
  const adapter = adapters[platformType]
  if (!adapter) {
    throw new Error(`Unknown platform: ${platformType}`)
  }
  return adapter
}
