import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { getOpenCodeConfigPaths } from "./opencode-config-dir"
import { parseJsonc } from "./jsonc-parser"
import { log } from "./logger"

/**
 * Persist default_agent to the OMO config file (fuyao-opencode.json) so that
 * the next OpenCode launch uses this agent as default. Called when user sends
 * a message in the main session with a given agent (UI switch is reflected on first message).
 */
export function persistDefaultAgent(agentName: string): void {
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

    if (existing.default_agent === agentName) return

    existing.default_agent = agentName
    writeFileSync(omoConfigPath, JSON.stringify(existing, null, 2) + "\n")
    log("[persist-default-agent] Wrote default_agent to config", { agent: agentName, path: omoConfigPath })
  } catch (err) {
    log("[persist-default-agent] Failed to persist default_agent", { agent: agentName, error: String(err) })
  }
}
