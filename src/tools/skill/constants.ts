export const TOOL_NAME = "skill" as const

export const TOOL_DESCRIPTION_NO_SKILLS = "Load a skill to get detailed instructions for a specific task. No skills are currently available."

export const TOOL_DESCRIPTION_PREFIX = `Load a skill to get detailed instructions for a specific task.

Skills provide specialized knowledge and step-by-step guidance.
Use this when a task matches an available skill's description.`

/** When skill_availability restricts list per agent, we don't list all skills in description; use list_available_skills to discover. */
export const TOOL_DESCRIPTION_AVAILABILITY_RESTRICTED = `Load a skill by name. Available skills depend on your current agent's configuration (agent's \`skills\` array). Use the \`list_available_skills\` tool to see which skills you can use, then call this tool with \`name=<skill_name>\`.` 
