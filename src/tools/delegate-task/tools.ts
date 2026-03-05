import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { DelegateTaskArgs, ToolContextWithMetadata, DelegateTaskToolOptions } from "./types"
import { DEFAULT_CATEGORIES, CATEGORY_DESCRIPTIONS } from "./constants"
import { log } from "../../shared"
import { buildSystemContent } from "./prompt-builder"
import {
  resolveSkillContent,
  resolveParentContext,
  executeBackgroundContinuation,
  executeSyncContinuation,
  resolveCategoryExecution,
  resolveSubagentExecution,
  executeUnstableAgentTask,
  executeBackgroundTask,
  executeSyncTask,
  getCallableSubagentNames,
} from "./executor"
import type { OpencodeClient } from "./types"
import type { ResolvedSubagentAvailability } from "./subagent-availability"

export { resolveCategoryConfig } from "./categories"
export { resolveSubagentAvailabilityConfig } from "./subagent-availability"
export type { SyncSessionCreatedEvent, DelegateTaskToolOptions, BuildSystemContentInput } from "./types"
export { buildSystemContent } from "./prompt-builder"

/**
 * Tool that returns the subagents the current agent can delegate to.
 * Respects subagent_availability: builtin/directory vs only configured; or full list when allowFullList.
 */
export function createListAvailableSubagentsTool(options: {
  client: OpencodeClient
  /** Resolved subagent_availability (builtin/directory vs only configured). */
  subagentAvailability?: ResolvedSubagentAvailability
}): ToolDefinition {
  return tool({
    description:
      "List the subagents your current agent can delegate to via delegate_task (subagent_type). Respects subagent_availability: only configured, or configured + builtin/directory. Call when the user asks what subagents are available or which agents you can delegate to.",
    args: {},
    async execute(_args: Record<string, unknown>, toolContext?: unknown) {
      const ctx = toolContext as { agent?: string } | undefined
      const currentAgent = ctx?.agent
      const names = await getCallableSubagentNames(options.client, currentAgent, {
        subagentAvailability: options.subagentAvailability,
      })
      if (names.length === 0) {
        return "No subagents are available for your current agent. Use category with delegate_task for category-based tasks, or configure subagents for platform agents."
      }
      return `Subagents available for your agent (${names.length}):\n\n${names.map((n) => `- ${n}`).join("\n")}\n\nUse delegate_task with subagent_type="<name>" to delegate.`
    },
  })
}

export function createDelegateTask(options: DelegateTaskToolOptions): ToolDefinition {
  const { userCategories } = options

  const allCategories = { ...DEFAULT_CATEGORIES, ...userCategories }
  const categoryNames = Object.keys(allCategories)
  const categoryExamples = categoryNames.map(k => `'${k}'`).join(", ")

  const categoryList = categoryNames.map(name => {
    const userDesc = userCategories?.[name]?.description
    const builtinDesc = CATEGORY_DESCRIPTIONS[name]
    const desc = userDesc || builtinDesc
    return desc ? `  - ${name}: ${desc}` : `  - ${name}`
  }).join("\n")

  const description = `Spawn agent task with category-based or direct agent selection.

MUTUALLY EXCLUSIVE: Provide EITHER category OR subagent_type, not both (unless continuing a session).

- load_skills: ALWAYS REQUIRED. Pass at least one skill name (e.g., ["playwright"], ["git-master", "frontend-ui-ux"]).
- category: Use predefined category → Spawns Sisyphus-Junior with category config
  Available categories:
${categoryList}
- subagent_type: Use specific agent directly (e.g., "oracle", "explore")
- run_in_background: true=async (returns task_id), false=sync (waits for result). Default: false. Use background=true ONLY for parallel exploration with 5+ independent queries.
- session_id: Existing Task session to continue (from previous task output). Continues agent with FULL CONTEXT PRESERVED - saves tokens, maintains continuity.
- command: The command that triggered this task (optional, for slash command tracking).

**WHEN TO USE session_id:**
- Task failed/incomplete → session_id with "fix: [specific issue]"
- Need follow-up on previous result → session_id with additional question
- Multi-turn conversation with same agent → always session_id instead of new task

Prompts MUST be in English.`

  return tool({
    description,
    args: {
      load_skills: tool.schema.array(tool.schema.string()).describe("Skill names to inject. REQUIRED - pass [] if no skills needed, but IT IS HIGHLY RECOMMENDED to pass proper skills like [\"playwright\"], [\"git-master\"] for best results."),
      description: tool.schema.string().describe("Short task description (3-5 words)"),
      prompt: tool.schema.string().describe("Full detailed prompt for the agent"),
      run_in_background: tool.schema.boolean().describe("true=async (returns task_id), false=sync (waits). Default: false"),
      category: tool.schema.string().optional().describe(`Category (e.g., ${categoryExamples}). Mutually exclusive with subagent_type.`),
      subagent_type: tool.schema.string().optional().describe("Agent name (e.g., 'oracle', 'explore'). Mutually exclusive with category."),
      session_id: tool.schema.string().optional().describe("Existing Task session to continue"),
      command: tool.schema.string().optional().describe("The command that triggered this task"),
    },
    async execute(args: DelegateTaskArgs, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata

      if (args.run_in_background === undefined) {
        throw new Error(`Invalid arguments: 'run_in_background' parameter is REQUIRED. Use run_in_background=false for task delegation, run_in_background=true only for parallel exploration.`)
      }
      if (args.load_skills === undefined) {
        throw new Error(`Invalid arguments: 'load_skills' parameter is REQUIRED. Pass [] if no skills needed, but IT IS HIGHLY RECOMMENDED to pass proper skills like ["playwright"], ["git-master"] for best results.`)
      }
      if (args.load_skills === null) {
        throw new Error(`Invalid arguments: load_skills=null is not allowed. Pass [] if no skills needed, but IT IS HIGHLY RECOMMENDED to pass proper skills.`)
      }

      const runInBackground = args.run_in_background === true

      const { content: skillContent, error: skillError } = await resolveSkillContent(args.load_skills, {
        gitMasterConfig: options.gitMasterConfig,
        browserProvider: options.browserProvider,
      })
      if (skillError) {
        return skillError
      }

      const parentContext = resolveParentContext(ctx)

      if (args.session_id) {
        if (runInBackground) {
          return executeBackgroundContinuation(args, ctx, options, parentContext)
        }
        return executeSyncContinuation(args, ctx, options)
      }

      if (args.category && args.subagent_type) {
        return `Invalid arguments: Provide EITHER category OR subagent_type, not both.`
      }

      if (!args.category && !args.subagent_type) {
        return `Invalid arguments: Must provide either category or subagent_type.`
      }

      let systemDefaultModel: string | undefined
      try {
        const openCodeConfig = await options.client.config.get()
        systemDefaultModel = (openCodeConfig as { data?: { model?: string } })?.data?.model
      } catch {
        systemDefaultModel = undefined
      }

      const inheritedModel = parentContext.model
        ? `${parentContext.model.providerID}/${parentContext.model.modelID}`
        : undefined

      let agentToUse: string
      let categoryModel: { providerID: string; modelID: string; variant?: string } | undefined
      let categoryPromptAppend: string | undefined
      let modelInfo: import("../../features/task-toast-manager/types").ModelFallbackInfo | undefined
      let actualModel: string | undefined
      let isUnstableAgent = false

      if (args.category) {
        const resolution = await resolveCategoryExecution(args, options, inheritedModel, systemDefaultModel)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        categoryPromptAppend = resolution.categoryPromptAppend
        modelInfo = resolution.modelInfo
        actualModel = resolution.actualModel
        isUnstableAgent = resolution.isUnstableAgent

        const isRunInBackgroundExplicitlyFalse = args.run_in_background === false || args.run_in_background === "false" as unknown as boolean

        log("[delegate_task] unstable agent detection", {
          category: args.category,
          actualModel,
          isUnstableAgent,
          run_in_background_value: args.run_in_background,
          run_in_background_type: typeof args.run_in_background,
          isRunInBackgroundExplicitlyFalse,
          willForceBackground: isUnstableAgent && isRunInBackgroundExplicitlyFalse,
        })

        if (isUnstableAgent && isRunInBackgroundExplicitlyFalse) {
          const systemContent = buildSystemContent({ skillContent, categoryPromptAppend, agentName: agentToUse })
          return executeUnstableAgentTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, actualModel)
        }
      } else {
        const resolution = await resolveSubagentExecution(args, options, parentContext.agent, categoryExamples)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
      }

      const systemContent = buildSystemContent({ skillContent, categoryPromptAppend, agentName: agentToUse })

      if (runInBackground) {
        return executeBackgroundTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent)
      }

      return executeSyncTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, modelInfo)
    },
  })
}
