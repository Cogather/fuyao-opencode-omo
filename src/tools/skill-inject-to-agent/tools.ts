import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { getSkillMarketListAll, downloadSkillToMarket, isSkillDownloaded } from "../../features/skill-market"
import { persistAgentSkill } from "../../shared"

/**
 * Tool: inject a skill (by market id) into an agent's skills config and persist to OMO config.
 * Optionally downloads the skill to configDir/skills/market/<skillId>/ when not present.
 * Skill name is taken from market item; agent_key can be builtin (e.g. sisyphus) or platform (e.g. fuyao:CodeHelper).
 */
export function createSkillInjectToAgentTool(): ToolDefinition {
  return tool({
    description:
      "Inject a skill from the skill market into an agent. Use skill_id (market id) and agent_key (e.g. sisyphus or fuyao:CodeHelper). Optionally download the skill to local market dir if not already present. Writes to OMO config so the agent has the skill on next load.",
    args: {
      agent_key: tool.schema
        .string()
        .describe("Agent config key: builtin (e.g. sisyphus) or platform (e.g. fuyao:CodeHelper)"),
      skill_id: tool.schema.string().describe("Skill market id (from skill_market_list)"),
      download_if_missing: tool.schema
        .boolean()
        .describe("If true, download skill to market dir when not already present")
        .optional(),
    },
    async execute(args): Promise<string> {
      const { agent_key, skill_id, download_if_missing = true } = args
      try {
        const list = await getSkillMarketListAll()
        const item = list.find((s) => s.id === skill_id)
        if (!item) {
          return `Error: skill_id "${skill_id}" not found in skill market.`
        }
        const skillName = item.name

        if (download_if_missing) {
          const ok = await isSkillDownloaded(skill_id)
          if (!ok) {
            await downloadSkillToMarket(skill_id)
          }
        }

        persistAgentSkill(agent_key, skillName)
        return `Injected skill "${skillName}" (${skill_id}) into agent "${agent_key}". Config updated; restart or reload for the agent to see the skill.`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Inject failed: ${message}`
      }
    },
  })
}
