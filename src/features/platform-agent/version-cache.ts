/**
 * Version cache: read/write per-platform agent name → version map.
 * Used by config-handler after merge, sync tool (compare/force_refresh), and publish tool (update after success).
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import type { PlatformType } from "./types"
import { PLATFORM_AGENT_CACHE_PREFIX } from "./constants"

export type VersionCacheMap = Record<string, string>

/**
 * Resolve cache file path for a platform. Uses project directory so cache is per-project.
 */
export function getCacheFilePath(platformType: PlatformType, directory: string): string {
  return join(directory, `${PLATFORM_AGENT_CACHE_PREFIX}${platformType}.json`)
}

/**
 * Read version cache for a platform. Returns {} if file missing or invalid.
 */
export function readVersionCache(platformType: PlatformType, directory: string): VersionCacheMap {
  const path = getCacheFilePath(platformType, directory)
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, "utf-8")
    const data = JSON.parse(raw) as unknown
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      return data as VersionCacheMap
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Write version cache for a platform.
 */
export function writeVersionCache(
  platformType: PlatformType,
  versions: VersionCacheMap,
  directory: string
): void {
  const path = getCacheFilePath(platformType, directory)
  writeFileSync(path, JSON.stringify(versions, null, 2), "utf-8")
}
