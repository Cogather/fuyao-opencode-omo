import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { getPlatformAgentToolSets } from "../../features/platform-agent"
import type { PlatformType } from "../../features/platform-agent"

function parsePlatformAgent(name: string): { platform: PlatformType; appName: string } | null {
  if (name.includes(":") && (name.startsWith("fuyao:") || name.startsWith("agentcenter:"))) {
    const platform = name.startsWith("fuyao:") ? "fuyao" : "agentcenter"
    const appName = name.slice(name.indexOf(":") + 1)
    return { platform, appName }
  }
  return null
}

/**
 * Tool: list platform-specific tools (toolSet / agentToolSet / workflowToolSet) for a platform agent.
 * Use before calling platform_invoke_tool to see available toolIds and descriptions.
 */
export function createPlatformListToolsTool(): ToolDefinition {
  return tool({
    description:
      "List platform-specific tools available for a platform agent (toolSet, agentToolSet, workflowToolSet). Call with agent_name e.g. fuyao:CodeHelper to get toolIds and descriptions; then use platform_invoke_tool with the desired tool_id and tool_type.",
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
        const sets = await getPlatformAgentToolSets(platform, appName)
        const lines: string[] = [`Platform tools for ${args.agent_name}:`]
        const fmt = (arr: Array<{ toolId: string; description?: string }>, type: string) => {
          if (arr.length === 0) return
          lines.push(`\n${type}:`)
          for (const t of arr) {
            lines.push(`  - ${t.toolId}: ${t.description ?? "(no description)"}`)
          }
        }
        fmt(sets.toolSet, "toolSet")
        fmt(sets.agentToolSet, "agentToolSet")
        fmt(sets.workflowToolSet, "workflowToolSet")
        if (sets.toolSet.length === 0 && sets.agentToolSet.length === 0 && sets.workflowToolSet.length === 0) {
          return `No platform-specific tools configured for ${args.agent_name}.`
        }
        lines.push("\nUse platform_invoke_tool with tool_id and tool_type to invoke.")
        return lines.join("\n")
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Failed to list platform tools: ${message}`
      }
    },
  })
}
