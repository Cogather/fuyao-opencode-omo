/**
 * Skill market API tests (design doc 6.3 S1, S2, S3).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  getSkillMarketList,
  getSkillMarketListAll,
  downloadSkillToMarket,
  isSkillDownloaded,
} from "./api"

describe("Skill market API (design doc 6.3 S1, S2, S3)", () => {
  let testDir: string
  let originalEnv: string | undefined

  beforeEach(() => {
    testDir = join(tmpdir(), `skill-market-api-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    originalEnv = process.env.OPENCODE_CONFIG_DIR
    process.env.OPENCODE_CONFIG_DIR = testDir
  })

  afterEach(() => {
    process.env.OPENCODE_CONFIG_DIR = originalEnv
    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })

  describe("S1: getSkillMarketList / getSkillMarketListAll", () => {
    test("getSkillMarketList 返回分页列表与 total/page/totalPages", async () => {
      const res = await getSkillMarketList({ page: 1, pageSize: 2 })
      expect(res.items).toBeDefined()
      expect(Array.isArray(res.items)).toBe(true)
      expect(res.total).toBeGreaterThanOrEqual(0)
      expect(res.page).toBe(1)
      expect(res.pageSize).toBe(2)
      expect(res.totalPages).toBeGreaterThanOrEqual(0)
    })

    test("getSkillMarketList 支持 query 过滤", async () => {
      const all = await getSkillMarketListAll()
      const withQuery = await getSkillMarketListAll({ query: "code" })
      expect(Array.isArray(withQuery)).toBe(true)
      if (all.length > 0 && withQuery.length > 0) {
        expect(
          withQuery.every(
            (s) =>
              s.name.toLowerCase().includes("code") ||
              (s.description?.toLowerCase().includes("code") ?? false)
          )
        ).toBe(true)
      }
    })

    test("getSkillMarketListAll 返回全量列表", async () => {
      const list = await getSkillMarketListAll()
      expect(Array.isArray(list)).toBe(true)
      const mockIds = ["market-code-review", "market-doc-helper", "market-test-gen"]
      const found = mockIds.filter((id) => list.some((s) => s.id === id))
      expect(found.length).toBeGreaterThan(0)
    })
  })

  describe("S2: downloadSkillToMarket", () => {
    test("在 getMarketSkillsDir()/<skillId>/ 下创建目录并写入 SKILL.md，返回 skillName、localPath", async () => {
      const result = await downloadSkillToMarket("market-code-review")
      expect(result.skillId).toBe("market-code-review")
      expect(result.skillName).toBeDefined()
      expect(result.localPath).toBeDefined()
      const skillDir = join(testDir, "skills", "market", "market-code-review")
      const skillMd = join(skillDir, "SKILL.md")
      expect(existsSync(skillMd)).toBe(true)
      const content = readFileSync(skillMd, "utf-8")
      expect(content).toContain("code-review")
    })
  })

  describe("S3: isSkillDownloaded", () => {
    test("目录存在且含 SKILL.md 返回 true", async () => {
      await downloadSkillToMarket("market-doc-helper")
      const ok = await isSkillDownloaded("market-doc-helper")
      expect(ok).toBe(true)
    })

    test("未下载或目录无 SKILL.md 返回 false", async () => {
      const ok = await isSkillDownloaded("nonexistent-skill-id")
      expect(ok).toBe(false)
    })
  })
})
