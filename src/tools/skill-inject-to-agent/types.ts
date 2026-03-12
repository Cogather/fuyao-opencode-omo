export interface SkillInjectToAgentArgs {
  /** Agent config key (e.g. "sisyphus", "fuyao:CodeHelper"). */
  agent_key: string
  /** Skill market id (to resolve name and optionally download). */
  skill_id: string
  /** If true, download skill to market dir when not already present. */
  download_if_missing?: boolean
}
