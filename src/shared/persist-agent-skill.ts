import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { getOpenCodeConfigPaths } from "./opencode-config-dir"
import { parseJsonc } from "./jsonc-parser"
import { log } from "./logger"

/**
 * Append a skill name to an agent's skills in the OMO config file (fuyao-opencode.json)
 * and persist to disk. Used when injecting a market skill into an agent (platform or builtin).
 * Creates agents[agentKey] if missing and sets skills: [skillName]; otherwise appends to existing skills array.
 */
export function persistAgentSkill(agentKey: string, skillName: string): void {
  try {
    const paths = getOpenCodeConfigPaths({ binary: "opencode", version: null })
    const omoConfigPath = paths.omoConfig

    let existing: Record<string, unknown> = {}
    if (existsSync(omoConfigPath)) {
      const content = readFileSync(omoConfigPath, "utf-8")
      const parsed = parseJsonc<Record<string, unknown>>(content)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed
      }
    }

    const agents = (existing.agents as Record<string, unknown>) ?? {}
    const agentEntry = (agents[agentKey] as Record<string, unknown>) ?? {}
    const skills = Array.isArray(agentEntry.skills)
      ? (agentEntry.skills as string[]).filter((s) => typeof s === "string")
      : []
    if (skills.includes(skillName)) {
      return
    }
    agents[agentKey] = { ...agentEntry, skills: [...skills, skillName] }
    existing.agents = agents
    writeFileSync(omoConfigPath, JSON.stringify(existing, null, 2) + "\n")
    log("[persist-agent-skill] Wrote agents skill to config", {
      agentKey,
      skillName,
      path: omoConfigPath,
    })
  } catch (err) {
    log("[persist-agent-skill] Failed to persist agent skill", {
      agentKey,
      skillName,
      error: String(err),
    })
    throw err
  }
}
