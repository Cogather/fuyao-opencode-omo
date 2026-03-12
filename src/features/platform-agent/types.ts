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

/** Adapter per platform: list + optional detail + optional publish. Connection/auth inside impl. */
export interface IPlatformAdapter {
  getAgentList(options?: GetAgentListOptions): Promise<PlatformAgentApp[]>
  /** Optional: get single app by id or name+version. When absent, api layer may fallback to list. */
  getAgentDetail?(options: GetAgentDetailOptions): Promise<PlatformAgentApp | null>
  /** Optional: publish/update app on platform. When absent, api layer mocks success. */
  publishAgent?(app: PlatformAgentApp): Promise<PublishResult>
}
