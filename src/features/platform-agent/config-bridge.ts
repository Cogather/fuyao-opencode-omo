/**
 * Maps PlatformAgentApp to OpenCode agent config. Agent key uses platform prefix to avoid clashes.
 */

import type { PlatformAgentApp, PlatformType } from "./types"

/** OpenCode agent config shape (subset we need). */
export type OpenCodeAgentEntry = Record<string, unknown>

/**
 * Convert one platform app to OpenCode agent entry. Key will be "fuyao:Name" or "agentcenter:Name".
 * Uses app.prompt as system prompt (from SDK / platform, or mock).
 */
export function platformAppToOpenCodeAgent(
  app: PlatformAgentApp,
  platform: PlatformType
): OpenCodeAgentEntry {
  const key = `${platform}:${app.name}`
  const entry: OpenCodeAgentEntry = {
    name: app.name,
    prompt: app.prompt,
    description: app.description ?? app.name,
  }
  if (app.model) entry.model = app.model
  if (app.permission && Object.keys(app.permission).length > 0) entry.permission = app.permission
  if (app.skills?.length) entry.skills = app.skills
  return entry
}

/**
 * Build config.agent-style record from platform apps: keys are "platform:AppName", values are OpenCode agent entries.
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
