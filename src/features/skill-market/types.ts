/**
 * Skill market types. Used for listing and downloading skills from the market.
 */

export interface SkillMarketItem {
  id: string
  name: string
  version?: string
  description?: string
  /** Download URL or package identifier; adapter uses this to fetch the skill. */
  downloadUrl?: string
  platform?: string
  license?: string
  compatibility?: string
}

export interface DownloadSkillToMarketResult {
  skillId: string
  /** Resolved skill name (from SKILL.md frontmatter or market item). */
  skillName: string
  /** Absolute path to the skill directory. */
  localPath: string
}
