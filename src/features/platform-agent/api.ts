/**
 * Platform agent API. getPlatformAgentList delegates to adapter (mock or real).
 * getPlatformAgentDetail uses adapter.getAgentDetail when present, else finds from list.
 * publishPlatformAgent calls adapter.publishAgent when present, otherwise mocks success.
 */

import type {
  PlatformType,
  PlatformAgentApp,
  GetAgentListOptions,
  GetAgentDetailOptions,
  PublishResult,
  InvokePlatformToolOptions,
  InvokePlatformToolResult,
} from "./types"
import { getPlatformAdapter } from "./platforms"
import { getPlatformToolSets } from "./platform-tool-registry"

export async function getPlatformAgentList(
  platformType: PlatformType,
  options?: GetAgentListOptions
): Promise<PlatformAgentApp[]> {
  const adapter = getPlatformAdapter(platformType)
  return adapter.getAgentList(options)
}

/**
 * Get a single agent app by id or name+version. Uses adapter.getAgentDetail when implemented;
 * otherwise falls back to getPlatformAgentList and finds by id or name.
 */
export async function getPlatformAgentDetail(
  platformType: PlatformType,
  options: GetAgentDetailOptions
): Promise<PlatformAgentApp | null> {
  const adapter = getPlatformAdapter(platformType)
  if (typeof adapter.getAgentDetail === "function") {
    return adapter.getAgentDetail(options)
  }
  const list = await adapter.getAgentList({})
  if (options.id) return list.find((a) => a.id === options.id) ?? null
  if (options.name) {
    const match = list.find(
      (a) => a.name === options.name && (options.version == null || a.version === options.version)
    )
    return match ?? null
  }
  return null
}

/**
 * Publish/update an agent app on the platform. Uses adapter.publishAgent when implemented;
 * otherwise mocks success (e.g. stage one with mock adapters).
 */
export async function publishPlatformAgent(
  platformType: PlatformType,
  app: PlatformAgentApp
): Promise<PublishResult> {
  const adapter = getPlatformAdapter(platformType)
  if (typeof adapter.publishAgent === "function") {
    return adapter.publishAgent(app)
  }
  return Promise.resolve({ version: app.version ?? "1.0.0" })
}

/** Tool sets for a platform agent (toolSet / agentToolSet / workflowToolSet). From registry or getAgentDetail. */
export interface PlatformAgentToolSets {
  toolSet: Array<{ toolId: string; description?: string; [k: string]: unknown }>
  agentToolSet: Array<{ toolId: string; description?: string; [k: string]: unknown }>
  workflowToolSet: Array<{ toolId: string; description?: string; [k: string]: unknown }>
}

export async function getPlatformAgentToolSets(
  platformType: PlatformType,
  agentName: string
): Promise<PlatformAgentToolSets> {
  const fromCache = getPlatformToolSets(platformType, agentName)
  if (fromCache) {
    return {
      toolSet: fromCache.toolSet ?? [],
      agentToolSet: fromCache.agentToolSet ?? [],
      workflowToolSet: fromCache.workflowToolSet ?? [],
    }
  }
  const detail = await getPlatformAgentDetail(platformType, { name: agentName })
  return {
    toolSet: detail?.tool_set ?? [],
    agentToolSet: detail?.agent_tool_set ?? [],
    workflowToolSet: detail?.workflow_tool_set ?? [],
  }
}

export async function invokePlatformTool(
  platformType: PlatformType,
  options: InvokePlatformToolOptions
): Promise<InvokePlatformToolResult> {
  const adapter = getPlatformAdapter(platformType)
  if (typeof adapter.invokeTool === "function") {
    return adapter.invokeTool(options)
  }
  return Promise.resolve({
    success: false,
    error: "Platform does not support tool invocation",
  })
}
