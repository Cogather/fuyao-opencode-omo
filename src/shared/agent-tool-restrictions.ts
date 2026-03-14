/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

/** Platform-only tools: only fuyao:* and agentcenter:* agents may use these. */
const PLATFORM_ONLY_TOOLS: Record<string, boolean> = {
  platform_invoke_tool: false,
  platform_list_tools: false,
}

function isPlatformAgentName(agentName: string): boolean {
  return (
    (agentName.startsWith("fuyao:") || agentName.startsWith("agentcenter:")) &&
    agentName.length > 6
  )
}

const EXPLORATION_AGENT_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  task: false,
  delegate_task: false,
  call_omo_agent: false,
}

const AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  explore: EXPLORATION_AGENT_DENYLIST,

  librarian: EXPLORATION_AGENT_DENYLIST,

  oracle: {
    write: false,
    edit: false,
    task: false,
    delegate_task: false,
  },

  "multimodal-looker": {
    read: true,
  },

  "sisyphus-junior": {
    task: false,
    delegate_task: false,
  },
}

export function getAgentToolRestrictions(agentName: string): Record<string, boolean> {
  const base =
    AGENT_RESTRICTIONS[agentName] ??
    Object.entries(AGENT_RESTRICTIONS).find(([key]) => key.toLowerCase() === agentName.toLowerCase())?.[1] ??
    {}
  if (!isPlatformAgentName(agentName)) {
    return { ...base, ...PLATFORM_ONLY_TOOLS }
  }
  return base
}

export function hasAgentToolRestrictions(agentName: string): boolean {
  const restrictions = AGENT_RESTRICTIONS[agentName]
    ?? Object.entries(AGENT_RESTRICTIONS).find(([key]) => key.toLowerCase() === agentName.toLowerCase())?.[1]
  return restrictions !== undefined && Object.keys(restrictions).length > 0
}
