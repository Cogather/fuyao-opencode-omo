/**
 * persistDefaultAgent tests (design doc 6.1 F10).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { persistDefaultAgent } from "./persist-default-agent"

describe("persistDefaultAgent (design doc 6.1 F10)", () => {
  let testDir: string
  let originalEnv: string | undefined

  beforeEach(() => {
    testDir = join(tmpdir(), `persist-default-agent-${Date.now()}`)
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

  test("写回 default_agent 到 OMO 配置文件", () => {
    persistDefaultAgent("fuyao:CodeHelper")
    const configPath = join(testDir, "fuyao-opencode.json")
    expect(existsSync(configPath)).toBe(true)
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content)
    expect(parsed.default_agent).toBe("fuyao:CodeHelper")
  })

  test("已有 default_agent 相同时不重复写入", () => {
    const configPath = join(testDir, "fuyao-opencode.json")
    writeFileSync(configPath, JSON.stringify({ default_agent: "sisyphus" }, null, 2) + "\n")
    persistDefaultAgent("sisyphus")
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content)
    expect(parsed.default_agent).toBe("sisyphus")
  })
})
