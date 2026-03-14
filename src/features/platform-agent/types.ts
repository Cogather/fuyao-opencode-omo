/**
 * Platform agent types. Stage one: list pull only; connection/auth is implementation detail.
 */

export type PlatformType = "fuyao" | "agentcenter"

/** One agent app as returned by platform adapter (and by SDK / platform API). */
export interface PlatformAgentApp {
  id: string
  name: string
  version?: string
  /** System prompt from platform/SDK; injected into OpenCode agent as prompt. */
  prompt: string
  model?: string
  permission?: Record<string, string>
  skills?: string[]
  mcps?: string[]
  subagents?: string[]
  /** OpenCode agent mode: subagent 仅作为子 agent 被引用，不单独出现在主列表 */
  mode?: "subagent" | "primary" | "all"
  description?: string
  /**
   * Optional skill definitions from platform: name -> OpenCode command/skill definition (name, description, template, etc.).
   * When present, merged into config.command so platform-pulled agents can use skills without local/market copy.
   */
  skill_definitions?: Record<string, Record<string, unknown>>
  /**
   * Optional MCP definitions from platform: name -> MCP server config (e.g. { type: "remote", url, enabled }).
   * When present, merged into config.mcp so platform-pulled agents can use MCPs without local config.
   */
  mcp_definitions?: Record<string, Record<string, unknown>>
  /**
   * Platform-specific tools: toolId + description; executed via platform API (invokeTool).
   * When present, exposed via platform_list_tools / platform_invoke_tool.
   */
  tool_set?: PlatformToolItem[]
  agent_tool_set?: PlatformToolItem[]
  workflow_tool_set?: PlatformToolItem[]
  /**
   * Platform user ids (or identifiers) who have admin rights to this agent app.
   * Only users in this list can publish changes to the platform; others can edit locally but cannot publish.
   */
  managers?: string[]
}

/** Single item in toolSet / agentToolSet / workflowToolSet (platform API shape). */
export interface PlatformToolItem {
  toolId: string
  description?: string
  [k: string]: unknown
}

export type PlatformToolType = "toolSet" | "agentToolSet" | "workflowToolSet"

/** Options for invoking a platform tool via adapter.invokeTool. */
export interface InvokePlatformToolOptions {
  /** Agent app name (e.g. CodeHelper) or config key (e.g. fuyao:CodeHelper). */
  agentName: string
  /** Platform tool id from toolSet/agentToolSet/workflowToolSet. */
  toolId: string
  /** Which set the tool belongs to. */
  toolType: PlatformToolType
  /** Request body for the platform execute API (platform-specific). */
  arguments?: Record<string, unknown>
}

/** Result of invokeTool (platform execute API response). */
export interface InvokePlatformToolResult {
  success: boolean
  output?: string
  error?: string
  [k: string]: unknown
}

export interface GetAgentListOptions {
  /** Optional pagination / filter; adapter may ignore if not supported. */
  limit?: number
  offset?: number
}

/** Result of publish (mock or real API). */
export interface PublishResult {
  version: string
}

/** Options for getAgentDetail: by id or by name+version. */
export interface GetAgentDetailOptions {
  /** Lookup by app id (platform-specific). */
  id?: string
  /** Lookup by name (and optional version). */
  name?: string
  version?: string
}

/** Adapter per platform: list + optional detail + optional publish + optional invokeTool. Connection/auth inside impl. */
export interface IPlatformAdapter {
  getAgentList(options?: GetAgentListOptions): Promise<PlatformAgentApp[]>
  /** Optional: get single app by id or name+version. When absent, api layer may fallback to list. */
  getAgentDetail?(options: GetAgentDetailOptions): Promise<PlatformAgentApp | null>
  /** Optional: publish/update app on platform. When absent, api layer mocks success. */
  publishAgent?(app: PlatformAgentApp): Promise<PublishResult>
  /** Optional: invoke a platform-specific tool (toolSet/agentToolSet/workflowToolSet). */
  invokeTool?(options: InvokePlatformToolOptions): Promise<InvokePlatformToolResult>
}
