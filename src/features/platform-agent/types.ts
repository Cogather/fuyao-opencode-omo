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
  description?: string
}

export interface GetAgentListOptions {
  /** Optional pagination / filter; adapter may ignore if not supported. */
  limit?: number
  offset?: number
}

/** Adapter per platform: fetches list and maps to PlatformAgentApp[]. Connection/auth inside impl. */
export interface IPlatformAdapter {
  getAgentList(options?: GetAgentListOptions): Promise<PlatformAgentApp[]>
}
