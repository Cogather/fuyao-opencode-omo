/**
 * Skill market API: list and download.
 * Phase 1: list 先渲染 mock 数据；Phase 2: 接入真实市场 API 后改为真实数据。
 */

import { promises as fs } from "node:fs"
import { join } from "node:path"
import { getMarketSkillsDir } from "../../shared/opencode-config-dir"
import type { SkillMarketItem, DownloadSkillToMarketResult } from "./types"
import { MOCK_SKILL_MARKET_ITEMS } from "./mock-data"

export interface GetSkillMarketListOptions {
  /** Optional search query: filter by name/description (mock). Real API 可传给后端. */
  query?: string
  /** 1-based page number for market list. */
  page?: number
  /** Items per page; default 10. */
  pageSize?: number
}

export interface SkillMarketListResult {
  items: SkillMarketItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DEFAULT_MARKET_PAGE_SIZE = 10

/** Phase 1: 仅返回 mock 列表，用于先渲染；Phase 2: 改为调用 getSkillMarketListFromRemote 或按配置切换。 */
async function getSkillMarketListFromMock(
  options?: GetSkillMarketListOptions
): Promise<SkillMarketItem[]> {
  const list = [...MOCK_SKILL_MARKET_ITEMS]
  const q = options?.query?.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description?.toLowerCase().includes(q) ?? false)
  )
}

/**
 * 获取技能市场列表（支持分页）。当前仅渲染 mock 数据；后续接入真实接口后在此处改为真实数据。
 * 返回一页数据与分页信息，便于换页展示。
 */
export async function getSkillMarketList(
  options?: GetSkillMarketListOptions
): Promise<SkillMarketListResult> {
  const all = await getSkillMarketListFromMock(options)
  // Phase 2: 接入真实 API 时在此替换或分支，例如:
  // const all = await getSkillMarketListFromRemote(options)

  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.max(1, options?.pageSize ?? DEFAULT_MARKET_PAGE_SIZE)
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const p = Math.min(page, totalPages)
  const start = (p - 1) * pageSize
  const items = all.slice(start, start + pageSize)

  return { items, total, page: p, pageSize, totalPages }
}

/** 获取市场全部列表（不分页），用于按 id 查找等。 */
export async function getSkillMarketListAll(
  options?: Pick<GetSkillMarketListOptions, "query">
): Promise<SkillMarketItem[]> {
  const res = await getSkillMarketList({
    ...options,
    page: 1,
    pageSize: 99999,
  })
  return res.items
}

/**
 * Download a skill from the market to the global market directory (configDir/skills/market/<skillId>/).
 * Creates a minimal SKILL.md so the skill is discoverable by opencode-skill-loader.
 * When real API exists: fetch package, extract to targetDir, return skill name from frontmatter.
 */
export async function downloadSkillToMarket(skillId: string): Promise<DownloadSkillToMarketResult> {
  const marketDir = getMarketSkillsDir()
  const item = (await getSkillMarketListAll()).find((s) => s.id === skillId)
  const name = item?.name ?? skillId
  const targetDir = join(marketDir, skillId)

  await fs.mkdir(targetDir, { recursive: true })

  const skillMdPath = join(targetDir, "SKILL.md")
  const content = `---
name: ${name}
description: ${item?.description ?? `Skill ${skillId} from market`}
---

# ${name}

${item?.description ?? "Skill content from market."}
`
  await fs.writeFile(skillMdPath, content, "utf-8")

  return { skillId, skillName: name, localPath: targetDir }
}

/** Check if a market skill is already downloaded (directory exists and has SKILL.md). */
export async function isSkillDownloaded(skillId: string): Promise<boolean> {
  const marketDir = getMarketSkillsDir()
  const skillDir = join(marketDir, skillId)
  const skillMd = join(skillDir, "SKILL.md")
  try {
    await fs.access(skillMd)
    return true
  } catch {
    return false
  }
}
