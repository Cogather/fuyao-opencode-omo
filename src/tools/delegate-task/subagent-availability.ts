/**
 * Subagent availability config resolution and builtin/directory classification.
 * Mirrors skill_availability: builtin = OMO builtin (no ":" in name), directory = platform (":" in name).
 */

import type { SubagentAvailabilityConfig } from "../../config/schema"

export interface ResolvedSubagentAvailability {
  allowFullList: boolean
  includeBuiltinInAvailable: boolean
  includeDirectoryInAvailable: boolean
}

/** Builtin = OMO builtin agents (name has no ":"). Directory = platform/config agents (name contains ":", e.g. fuyao:CodeHelper). */
export function isBuiltinSubagent(agentName: string): boolean {
  return !agentName.includes(":")
}

export function isDirectorySubagent(agentName: string): boolean {
  return agentName.includes(":")
}

/**
 * Resolve subagent_availability config.
 * - true -> allowFullList, ignores includes.
 * - undefined / false / object -> allowFullList false, include_* default false.
 */
export function resolveSubagentAvailabilityConfig(
  config: true | SubagentAvailabilityConfig | undefined
): ResolvedSubagentAvailability {
  if (config === true) {
    return {
      allowFullList: true,
      includeBuiltinInAvailable: false,
      includeDirectoryInAvailable: false,
    }
  }
  const obj = config && typeof config === "object" ? config : undefined
  return {
    allowFullList: false,
    includeBuiltinInAvailable: obj?.include_builtin_in_available === true,
    includeDirectoryInAvailable: obj?.include_directory_in_available === true,
  }
}
