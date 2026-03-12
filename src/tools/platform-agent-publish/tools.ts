import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { OhMyOpenCodeConfig } from "../../config"
import {
  getPlatformAgentList,
  publishPlatformAgent,
  openCodeAgentToPlatformApp,
  readVersionCache,
  writeVersionCache,
} from "../../features/platform-agent"
import type { PlatformType } from "../../features/platform-agent"

function parsePlatformAgent(name: string): { platform: PlatformType; appName: string } | null {
  if (name.includes(":") && (name.startsWith("fuyao:") || name.startsWith("agentcenter:"))) {
    const platform = name.startsWith("fuyao:") ? "fuyao" : "agentcenter"
    const appName = name.slice(name.indexOf(":") + 1)
    return { platform, appName }
  }
  return null
}

export interface PlatformAgentPublishOptions {
  directory: string
  pluginConfig: OhMyOpenCodeConfig
}

export function createPlatformAgentPublishTool(
  options: PlatformAgentPublishOptions
): ToolDefinition {
  const { directory, pluginConfig } = options

  return tool({
    description:
      "Publish or update a platform agent (e.g. fuyao:CodeHelper) to the platform. Merges local config (prompt, skills, mcps, subagents) with platform base and uploads. Updates local version cache on success.",
    args: {
      agent_name: tool.schema
        .string()
        .describe('Platform agent key, e.g. "fuyao:CodeHelper" or "agentcenter:Reviewer"'),
    },
    async execute(args): Promise<string> {
      const parsed = parsePlatformAgent(args.agent_name)
      if (!parsed) {
        return `Error: agent_name must be a platform agent key (fuyao:Name or agentcenter:Name), got: ${args.agent_name}`
      }
      const { platform, appName } = parsed
      try {
        const apps = await getPlatformAgentList(platform)
        const base = apps.find((a) => a.name === appName)
        const userOverride = pluginConfig.agents?.[args.agent_name] as Record<string, unknown> | undefined
        const entry = {
          name: args.agent_name,
          prompt: base?.prompt ?? "",
          description: base?.description ?? appName,
          ...(base?.version ? { version: base.version } : {}),
          ...(base?.model ? { model: base.model } : {}),
          ...(base?.permission ? { permission: base.permission } : {}),
          ...(base?.skills ? { skills: base.skills } : {}),
          ...(base?.mcps ? { mcps: base.mcps } : {}),
          ...(base?.subagents ? { subagents: base.subagents } : {}),
          ...(base?.mode ? { mode: base.mode } : {}),
          ...userOverride,
        }
        const app = openCodeAgentToPlatformApp(entry, platform)
        const result = await publishPlatformAgent(platform, app)
        const cached = readVersionCache(platform, directory)
        cached[appName] = result.version
        writeVersionCache(platform, cached, directory)
        return `Published "${args.agent_name}" to ${platform}; version ${result.version}. Local cache updated.`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Publish failed: ${message}`
      }
    },
  })
}
