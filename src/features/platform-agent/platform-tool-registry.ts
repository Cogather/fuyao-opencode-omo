/**
 * In-memory cache of platform agent tool sets (toolSet / agentToolSet / workflowToolSet).
 * Populated by config-handler when loading platform agents; read by platform_list_tools / platform_invoke_tool.
 */

import type { PlatformType } from "./types"
import type { PlatformToolItem } from "./types"

export interface PlatformToolSets {
  toolSet?: PlatformToolItem[]
  agentToolSet?: PlatformToolItem[]
  workflowToolSet?: PlatformToolItem[]
}

const cache = new Map<string, PlatformToolSets>()

function key(platform: PlatformType, agentName: string): string {
  return `${platform}:${agentName}`
}

export function setPlatformToolSets(
  platform: PlatformType,
  agentName: string,
  sets: PlatformToolSets
): void {
  if (
    (sets.toolSet?.length ?? 0) === 0 &&
    (sets.agentToolSet?.length ?? 0) === 0 &&
    (sets.workflowToolSet?.length ?? 0) === 0
  ) {
    return
  }
  cache.set(key(platform, agentName), sets)
}

export function getPlatformToolSets(
  platform: PlatformType,
  agentName: string
): PlatformToolSets | undefined {
  return cache.get(key(platform, agentName))
}
