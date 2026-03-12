/**
 * Maps PlatformAgentApp to OpenCode agent config. Agent key = "platform:name" to distinguish platforms (e.g. fuyao:CodeHelper).
 */

import type { PlatformAgentApp, PlatformType } from "./types"

/** OpenCode agent config shape (subset we need). */
export type OpenCodeAgentEntry = Record<string, unknown>

/**
 * Convert one platform app to OpenCode agent entry. Config key is "platform:name" (e.g. fuyao:CodeHelper, agentcenter:Reviewer).
 * entry.name must equal the config key so OpenCode lookups (e.g. agent.name) resolve; description stays human-readable.
 */
export function platformAppToOpenCodeAgent(
  app: PlatformAgentApp,
  platform: PlatformType
): OpenCodeAgentEntry {
  const key = `${platform}:${app.name}`
  const entry: OpenCodeAgentEntry = {
    name: key,
    prompt: app.prompt,
    description: app.description ?? app.name,
  }
  if (app.model) entry.model = app.model
  if (app.permission && Object.keys(app.permission).length > 0) entry.permission = app.permission
  if (app.skills?.length) entry.skills = app.skills
  if (app.subagents?.length) entry.subagents = app.subagents
  if (app.mcps?.length) entry.mcps = app.mcps
  if (app.mode) entry.mode = app.mode
  return entry
}

/**
 * Build config.agent-style record from platform apps: keys are "platform:name" (e.g. fuyao:CodeHelper, agentcenter:Reviewer), name 与 mock-data 的 name 字段一致.
 */
export function platformAppsToAgentRecord(
  apps: PlatformAgentApp[],
  platform: PlatformType
): Record<string, OpenCodeAgentEntry> {
  const record: Record<string, OpenCodeAgentEntry> = {}
  for (const app of apps) {
    const key = `${platform}:${app.name}`
    record[key] = platformAppToOpenCodeAgent(app, platform)
  }
  return record
}

/**
 * Convert OpenCode agent entry (key = "platform:name") to PlatformAgentApp for publish body.
 * Used when publishing local changes (prompt, skills, mcps, subagents) back to platform.
 */
export function openCodeAgentToPlatformApp(
  entry: OpenCodeAgentEntry,
  platform: PlatformType
): PlatformAgentApp {
  const name = entry.name as string
  const appName = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name
  const app: PlatformAgentApp = {
    id: (entry as { id?: string }).id ?? appName,
    name: appName,
    version: (entry as { version?: string }).version,
    prompt: (entry.prompt as string) ?? "",
    description: (entry.description as string) ?? appName,
  }
  if (entry.model) app.model = entry.model as string
  if (entry.permission && typeof entry.permission === "object")
    app.permission = entry.permission as Record<string, string>
  if (Array.isArray(entry.skills)) app.skills = entry.skills as string[]
  if (Array.isArray(entry.mcps)) app.mcps = entry.mcps as string[]
  if (Array.isArray(entry.subagents)) app.subagents = entry.subagents as string[]
  if (entry.mode) app.mode = entry.mode as "subagent" | "primary" | "all"
  return app
}
