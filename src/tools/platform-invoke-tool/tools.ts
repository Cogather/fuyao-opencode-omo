import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { invokePlatformTool } from "../../features/platform-agent"
import type { PlatformType, PlatformToolType } from "../../features/platform-agent"

function parsePlatformAgent(name: string): { platform: PlatformType; appName: string } | null {
  if (name.includes(":") && (name.startsWith("fuyao:") || name.startsWith("agentcenter:"))) {
    const platform = name.startsWith("fuyao:") ? "fuyao" : "agentcenter"
    const appName = name.slice(name.indexOf(":") + 1)
    return { platform, appName }
  }
  return null
}

/**
 * Tool: invoke a platform-specific tool (toolSet / agentToolSet / workflowToolSet).
 * Only for platform agents; call platform_list_tools first to get available toolIds.
 */
export function createPlatformInvokeToolTool(): ToolDefinition {
  return tool({
    description:
      "Invoke a platform-specific tool for a platform agent. Provide agent_name (e.g. fuyao:CodeHelper), tool_id and tool_type (toolSet | agentToolSet | workflowToolSet). Use platform_list_tools to see available tools. Only usable when current agent is a platform agent.",
    args: {
      agent_name: tool.schema
        .string()
        .describe('Platform agent key, e.g. "fuyao:CodeHelper" or "agentcenter:Reviewer"'),
      tool_id: tool.schema.string().describe("Tool id from platform_list_tools (e.g. fuyao-code-gen)"),
      tool_type: tool.schema
        .enum(["toolSet", "agentToolSet", "workflowToolSet"])
        .describe("Which set the tool belongs to"),
      arguments: tool.schema
        .object()
        .optional()
        .describe("Optional JSON object passed to the platform execute API"),
    },
    async execute(args, toolContext?: unknown): Promise<string> {
      const parsed = parsePlatformAgent(args.agent_name)
      if (!parsed) {
        return `Error: agent_name must be a platform agent key (fuyao:Name or agentcenter:Name), got: ${args.agent_name}`
      }
      const ctx = toolContext as { agent?: string } | undefined
      const currentAgent = ctx?.agent
      if (currentAgent && (currentAgent.startsWith("fuyao:") || currentAgent.startsWith("agentcenter:"))) {
        if (currentAgent !== args.agent_name) {
          return `Error: platform_invoke_tool can only be used for the current agent. Current agent is ${currentAgent}, requested ${args.agent_name}.`
        }
      }
      const { platform, appName } = parsed
      try {
        const result = await invokePlatformTool(platform, {
          agentName: appName,
          toolId: args.tool_id,
          toolType: args.tool_type as PlatformToolType,
          arguments: args.arguments as Record<string, unknown> | undefined,
        })
        if (result.success) {
          return result.output ?? "Tool executed successfully (no output)."
        }
        return `Tool invocation failed: ${result.error ?? "Unknown error"}`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Invoke failed: ${message}`
      }
    },
  })
}
