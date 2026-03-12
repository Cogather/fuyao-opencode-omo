/**
 * skill_inject_to_agent tool tests (design doc 6.3 S5).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { createSkillInjectToAgentTool } from "./tools"

describe("skill_inject_to_agent (design doc 6.3 S5)", () => {
  let testDir: string
  let originalEnv: string | undefined

  beforeEach(() => {
    testDir = join(tmpdir(), `skill-inject-${Date.now()}`)
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

  test("execute 解析 market 条目、persistAgentSkill 写回配置", async () => {
    const tool = createSkillInjectToAgentTool()
    const result = await tool.execute!(
      {
        agent_key: "fuyao:CodeHelper",
        skill_id: "market-code-review",
        download_if_missing: true,
      },
      {} as any
    )
    expect(result).toContain("Injected skill")
    expect(result).toContain("code-review")
    const configPath = join(testDir, "fuyao-opencode.json")
    expect(existsSync(configPath)).toBe(true)
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content)
    expect(parsed.agents?.["fuyao:CodeHelper"]?.skills).toContain("code-review")
  })

  test("skill_id 不存在时返回 Error 文案", async () => {
    const tool = createSkillInjectToAgentTool()
    const result = await tool.execute!(
      { agent_key: "sisyphus", skill_id: "nonexistent-id", download_if_missing: false },
      {} as any
    )
    expect(result).toContain("Error")
    expect(result).toContain("not found")
  })
})
