import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { OhMyOpenCodeConfig } from "../../config"
import {
  getPlatformAgentList,
  readVersionCache,
  writeVersionCache,
} from "../../features/platform-agent"
import type { PlatformType } from "../../features/platform-agent"

export interface PlatformAgentSyncOptions {
  directory: string
  pluginConfig: OhMyOpenCodeConfig
}

export function createPlatformAgentSyncTool(
  options: PlatformAgentSyncOptions
): ToolDefinition {
  const { directory, pluginConfig } = options

  return tool({
    description:
      "Sync platform agent versions: compare local cache with platform list. Use force_refresh to overwrite cache with current platform state. Returns which agents have updates or '当前与平台一致'.",
    args: {
      platform_type: tool.schema
        .enum(["fuyao", "agentcenter"])
        .describe("Platform to sync: fuyao or agentcenter"),
      force_refresh: tool.schema
        .boolean()
        .describe("If true, overwrite local cache with platform list and return 已刷新")
        .optional(),
    },
    async execute(args): Promise<string> {
      const platform = args.platform_type as PlatformType
      const pa = pluginConfig.platform_agent
      if (!pa?.enabled || !pa.platforms?.length) {
        return "Platform agent is disabled or no platforms configured."
      }
      if (!pa.platforms.includes(platform)) {
        return `Platform "${platform}" is not in configured platforms (${pa.platforms.join(", ")}).`
      }
      try {
        const list = await getPlatformAgentList(platform)
        const cached = readVersionCache(platform, directory)

        if (args.force_refresh === true) {
          const versionMap = Object.fromEntries(
            list.map((a) => [a.name, a.version ?? "0"])
          )
          writeVersionCache(platform, versionMap, directory)
          return `已刷新到平台最新，共 ${list.length} 个应用。`
        }

        const outdated = list.filter(
          (a) => (a.version ?? "0") !== (cached[a.name] ?? "")
        )
        if (outdated.length === 0) {
          return "当前与平台一致。"
        }
        const names = outdated.map((a) => a.name).join("、")
        return `以下 Agent 有更新：${names}。可执行 /platform-sync 并带 force_refresh 更新本地缓存。`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Sync failed: ${message}`
      }
    },
  })
}
