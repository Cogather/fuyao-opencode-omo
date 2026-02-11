/**
 * Filters merged skills into "available for this agent" list based on
 * skill_availability config and agent.skills (on-demand).
 */

import type { LoadedSkill } from "./types"
import type { SkillAvailabilityConfig } from "../../config/schema"

const BUILTIN_SCOPE = "builtin"

export interface GetAvailableSkillsForAgentOptions {
  /** Skill names configured for this agent (agent.skills). */
  agentSkillNames: string[]
  /** Full merged skill list (builtin + config + directories). */
  mergedSkills: LoadedSkill[]
  /** When true, all builtin skills are available; when false, only if in agentSkillNames. Default true. */
  includeBuiltinInAvailable?: boolean
  /** When true, all directory/config skills are available; when false, only if in agentSkillNames. Default true. */
  includeDirectoryInAvailable?: boolean
}

/**
 * Returns the list of skills that are "available" for the given agent:
 * - Always includes any skill whose name is in agentSkillNames (resolved from mergedSkills).
 * - If includeBuiltinInAvailable !== false, adds all builtin (scope === "builtin") skills.
 * - If includeDirectoryInAvailable !== false, adds all non-builtin skills (user, project, opencode, config, etc.).
 * Order: agent-configured first, then builtin (if included), then directory (if included); deduped by name.
 */
export function getAvailableSkillsForAgent(options: GetAvailableSkillsForAgentOptions): LoadedSkill[] {
  const {
    agentSkillNames,
    mergedSkills,
    includeBuiltinInAvailable = true,
    includeDirectoryInAvailable = true,
  } = options

  const byName = new Map<string, LoadedSkill>()
  for (const s of mergedSkills) {
    byName.set(s.name, s)
  }

  const result: LoadedSkill[] = []
  const added = new Set<string>()

  // 1) Always add skills explicitly configured for this agent
  for (const name of agentSkillNames) {
    const skill = byName.get(name)
    if (skill && !added.has(skill.name)) {
      result.push(skill)
      added.add(skill.name)
    }
  }

  // 2) If builtin included, add all builtin
  if (includeBuiltinInAvailable) {
    for (const skill of mergedSkills) {
      if (skill.scope === BUILTIN_SCOPE && !added.has(skill.name)) {
        result.push(skill)
        added.add(skill.name)
      }
    }
  }

  // 3) If directory included, add all non-builtin
  if (includeDirectoryInAvailable) {
    for (const skill of mergedSkills) {
      if (skill.scope !== BUILTIN_SCOPE && !added.has(skill.name)) {
        result.push(skill)
        added.add(skill.name)
      }
    }
  }

  return result
}

/**
 * Resolve skill_availability config with defaults (both true = backward compat).
 */
export function resolveSkillAvailabilityConfig(
  config: SkillAvailabilityConfig | undefined
): { includeBuiltinInAvailable: boolean; includeDirectoryInAvailable: boolean } {
  return {
    includeBuiltinInAvailable: config?.include_builtin_in_available !== false,
    includeDirectoryInAvailable: config?.include_directory_in_available !== false,
  }
}
