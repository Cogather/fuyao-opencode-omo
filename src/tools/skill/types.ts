import type { SkillScope, LoadedSkill } from "../../features/opencode-skill-loader/types"
import type { SkillMcpManager } from "../../features/skill-mcp-manager"
import type { GitMasterConfig } from "../../config/schema"

export interface SkillArgs {
  name: string
}

export interface SkillInfo {
  name: string
  description: string
  location?: string
  scope: SkillScope
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string[]
}

export interface SkillAvailabilityOption {
  includeBuiltinInAvailable: boolean
  includeDirectoryInAvailable: boolean
}

export interface SkillLoadOptions {
  /** When true, only load from OpenCode paths (.opencode/skills/, ~/.config/opencode/skills/) */
  opencodeOnly?: boolean
  /** Pre-merged skills to use instead of discovering */
  skills?: LoadedSkill[]
  /** Resolve available skills for current agent (used when skill_availability restricts list). */
  getAvailableSkills?: (agent?: string) => Promise<LoadedSkill[]>
  /** Resolved skill_availability config; when either is false, description is generic and execute filters by getAvailableSkills. */
  skillAvailability?: SkillAvailabilityOption
  /** MCP manager for querying skill-embedded MCP servers */
  mcpManager?: SkillMcpManager
  /** Session ID getter for MCP client identification */
  getSessionID?: () => string
  /** Git master configuration for watermark/co-author settings */
  gitMasterConfig?: GitMasterConfig
}
