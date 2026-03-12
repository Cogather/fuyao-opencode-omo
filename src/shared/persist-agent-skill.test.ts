/**
 * persistAgentSkill tests (design doc 6.3 S6).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { persistAgentSkill } from "./persist-agent-skill"

describe("persistAgentSkill (design doc 6.3 S6)", () => {
  let testDir: string
  let originalEnv: string | undefined

  beforeEach(() => {
    testDir = join(tmpdir(), `persist-agent-skill-${Date.now()}`)
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

  test("creates agents[agentKey] with skills: [skillName] when config missing", () => {
    persistAgentSkill("fuyao:CodeHelper", "skill-market/ReadmeWriter")
    const configPath = join(testDir, "fuyao-opencode.json")
    expect(existsSync(configPath)).toBe(true)
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content)
    expect(parsed.agents).toBeDefined()
    expect(parsed.agents["fuyao:CodeHelper"]).toBeDefined()
    expect(parsed.agents["fuyao:CodeHelper"].skills).toEqual(["skill-market/ReadmeWriter"])
  })

  test("appends skill to existing agent skills without duplicating", () => {
    const configPath = join(testDir, "fuyao-opencode.json")
    const initial = {
      agents: {
        "fuyao:CodeHelper": { prompt: "Help", skills: ["existing-skill"] },
      },
    }
    writeFileSync(configPath, JSON.stringify(initial, null, 2) + "\n")
    persistAgentSkill("fuyao:CodeHelper", "skill-market/NewSkill")
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content)
    expect(parsed.agents["fuyao:CodeHelper"].skills).toEqual(["existing-skill", "skill-market/NewSkill"])
    persistAgentSkill("fuyao:CodeHelper", "skill-market/NewSkill")
    const content2 = readFileSync(configPath, "utf-8")
    const parsed2 = JSON.parse(content2)
    expect(parsed2.agents["fuyao:CodeHelper"].skills).toEqual(["existing-skill", "skill-market/NewSkill"])
  })
})
