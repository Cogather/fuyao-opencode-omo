import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEST_DIR = join(tmpdir(), "skill-loader-test-" + Date.now())
const SKILLS_DIR = join(TEST_DIR, ".opencode", "skills")

function createTestSkill(name: string, content: string, mcpJson?: object): string {
  const skillDir = join(SKILLS_DIR, name)
  mkdirSync(skillDir, { recursive: true })
  const skillPath = join(skillDir, "SKILL.md")
  writeFileSync(skillPath, content)
  if (mcpJson) {
    writeFileSync(join(skillDir, "mcp.json"), JSON.stringify(mcpJson, null, 2))
  }
  return skillDir
}

describe("skill loader MCP parsing", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe("parseSkillMcpConfig", () => {
    it("parses skill with nested MCP config", async () => {
      // given
      const skillContent = `---
name: test-skill
description: A test skill with MCP
mcp:
  sqlite:
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - ./data.db
  memory:
    command: npx
    args: [-y, "@anthropic-ai/mcp-server-memory"]
---
This is the skill body.
`
      createTestSkill("test-mcp-skill", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "test-skill")

        // then
        expect(skill).toBeDefined()
        expect(skill?.mcpConfig).toBeDefined()
        expect(skill?.mcpConfig?.sqlite).toBeDefined()
        expect(skill?.mcpConfig?.sqlite?.command).toBe("uvx")
        expect(skill?.mcpConfig?.sqlite?.args).toEqual([
          "mcp-server-sqlite",
          "--db-path",
          "./data.db"
        ])
        expect(skill?.mcpConfig?.memory).toBeDefined()
        expect(skill?.mcpConfig?.memory?.command).toBe("npx")
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("returns undefined mcpConfig for skill without MCP", async () => {
      // given
      const skillContent = `---
name: simple-skill
description: A simple skill without MCP
---
This is a simple skill.
`
      createTestSkill("simple-skill", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "simple-skill")

        // then
        expect(skill).toBeDefined()
        expect(skill?.mcpConfig).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("preserves env var placeholders without expansion", async () => {
      // given
      const skillContent = `---
name: env-skill
mcp:
  api-server:
    command: node
    args: [server.js]
    env:
      API_KEY: "\${API_KEY}"
      DB_PATH: "\${HOME}/data.db"
---
Skill with env vars.
`
      createTestSkill("env-skill", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "env-skill")

        // then
        expect(skill?.mcpConfig?.["api-server"]?.env?.API_KEY).toBe("${API_KEY}")
        expect(skill?.mcpConfig?.["api-server"]?.env?.DB_PATH).toBe("${HOME}/data.db")
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("handles malformed YAML gracefully", async () => {
      // given - malformed YAML causes entire frontmatter to fail parsing
      const skillContent = `---
name: bad-yaml
mcp: [this is not valid yaml for mcp
---
Skill body.
`
      createTestSkill("bad-yaml-skill", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        // then - when YAML fails, skill uses directory name as fallback
        const skill = skills.find(s => s.name === "bad-yaml-skill")

        expect(skill).toBeDefined()
        expect(skill?.mcpConfig).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
      }
    })
  })

  describe("mcp.json file loading (AmpCode compat)", () => {
    it("loads MCP config from mcp.json with mcpServers format", async () => {
      // given
      const skillContent = `---
name: ampcode-skill
description: Skill with mcp.json
---
Skill body.
`
      const mcpJson = {
        mcpServers: {
          playwright: {
            command: "npx",
            args: ["@playwright/mcp@latest"]
          }
        }
      }
      createTestSkill("ampcode-skill", skillContent, mcpJson)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "ampcode-skill")

        // then
        expect(skill).toBeDefined()
        expect(skill?.mcpConfig).toBeDefined()
        expect(skill?.mcpConfig?.playwright).toBeDefined()
        expect(skill?.mcpConfig?.playwright?.command).toBe("npx")
        expect(skill?.mcpConfig?.playwright?.args).toEqual(["@playwright/mcp@latest"])
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("mcp.json takes priority over YAML frontmatter", async () => {
      // given
      const skillContent = `---
name: priority-skill
mcp:
  from-yaml:
    command: yaml-cmd
    args: [yaml-arg]
---
Skill body.
`
      const mcpJson = {
        mcpServers: {
          "from-json": {
            command: "json-cmd",
            args: ["json-arg"]
          }
        }
      }
      createTestSkill("priority-skill", skillContent, mcpJson)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "priority-skill")

        // then - mcp.json should take priority
        expect(skill?.mcpConfig?.["from-json"]).toBeDefined()
        expect(skill?.mcpConfig?.["from-yaml"]).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("supports direct format without mcpServers wrapper", async () => {
      // given
      const skillContent = `---
name: direct-format
---
Skill body.
`
      const mcpJson = {
        sqlite: {
          command: "uvx",
          args: ["mcp-server-sqlite"]
        }
      }
      createTestSkill("direct-format", skillContent, mcpJson)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "direct-format")

        // then
        expect(skill?.mcpConfig?.sqlite).toBeDefined()
        expect(skill?.mcpConfig?.sqlite?.command).toBe("uvx")
      } finally {
        process.chdir(originalCwd)
      }
      })
  })

  describe("allowed-tools parsing", () => {
    it("parses space-separated allowed-tools string", async () => {
      // given
      const skillContent = `---
name: space-separated-tools
description: Skill with space-separated allowed-tools
allowed-tools: Read Write Edit Bash
---
Skill body.
`
      createTestSkill("space-separated-tools", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "space-separated-tools")

        // then
        expect(skill).toBeDefined()
        expect(skill?.allowedTools).toEqual(["Read", "Write", "Edit", "Bash"])
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("parses YAML inline array allowed-tools", async () => {
      // given
      const skillContent = `---
name: yaml-inline-array
description: Skill with YAML inline array allowed-tools
allowed-tools: [Read, Write, Edit, Bash]
---
Skill body.
`
      createTestSkill("yaml-inline-array", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "yaml-inline-array")

        // then
        expect(skill).toBeDefined()
        expect(skill?.allowedTools).toEqual(["Read", "Write", "Edit", "Bash"])
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("parses YAML multi-line array allowed-tools", async () => {
      // given
      const skillContent = `---
name: yaml-multiline-array
description: Skill with YAML multi-line array allowed-tools
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---
Skill body.
`
      createTestSkill("yaml-multiline-array", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "yaml-multiline-array")

        // then
        expect(skill).toBeDefined()
        expect(skill?.allowedTools).toEqual(["Read", "Write", "Edit", "Bash"])
      } finally {
        process.chdir(originalCwd)
      }
    })

    it("returns undefined for skill without allowed-tools", async () => {
      // given
      const skillContent = `---
name: no-allowed-tools
description: Skill without allowed-tools field
---
Skill body.
`
      createTestSkill("no-allowed-tools", skillContent)

      // when
      const { discoverSkills } = await import("./loader")
      const originalCwd = process.cwd()
      process.chdir(TEST_DIR)

      try {
        const skills = await discoverSkills({ includeClaudeCodePaths: false })
        const skill = skills.find(s => s.name === "no-allowed-tools")

        // then
        expect(skill).toBeDefined()
        expect(skill?.allowedTools).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
      }
    })
  })

  describe("Design doc 6.3 S4 - discoverOpencodeGlobalSkills 含 market 目录", () => {
    it("getMarketSkillsDir() 下子目录被扫描，市场 skill 进入结果", async () => {
      const marketTestDir = join(tmpdir(), "skill-loader-market-" + Date.now())
      const marketDir = join(marketTestDir, "skills", "market")
      const skillDir = join(marketDir, "market-test-skill")
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(
        join(skillDir, "SKILL.md"),
        `---
name: market-test-skill
description: Skill from market dir
---
# market-test-skill
`
      )
      const originalEnv = process.env.OPENCODE_CONFIG_DIR
      process.env.OPENCODE_CONFIG_DIR = marketTestDir
      try {
        const { discoverOpencodeGlobalSkills } = await import("./loader")
        const skills = await discoverOpencodeGlobalSkills()
        const found = skills.find((s) => s.name === "market-test-skill")
        expect(found).toBeDefined()
        expect(found!.name).toBe("market-test-skill")
      } finally {
        process.env.OPENCODE_CONFIG_DIR = originalEnv
        rmSync(marketTestDir, { recursive: true, force: true })
      }
    })
  })

  describe("skill_directories - 自定义目录识别与加载", () => {
    it("配置 skill_directories 后，该目录下 skill 被扫描且 scope 为 custom", async () => {
      const testRoot = join(tmpdir(), "skill-loader-custom-dirs-" + Date.now())
      const configDir = join(testRoot, "config")
      const customSkillsDir = join(testRoot, "custom-skills")
      const skillSubDir = join(customSkillsDir, "my-custom-skill")
      mkdirSync(configDir, { recursive: true })
      mkdirSync(skillSubDir, { recursive: true })
      writeFileSync(
        join(configDir, "fuyao-opencode.json"),
        JSON.stringify({ skill_directories: [customSkillsDir] }, null, 2)
      )
      writeFileSync(
        join(skillSubDir, "SKILL.md"),
        `---
name: my-custom-skill
description: Skill from custom directory
---
# my-custom-skill
`
      )
      const originalEnv = process.env.OPENCODE_CONFIG_DIR
      const originalCwd = process.cwd()
      process.env.OPENCODE_CONFIG_DIR = configDir
      process.chdir(testRoot)
      try {
        const { discoverOpencodeGlobalSkills, discoverCustomSkills } = await import("./loader")
        const customOnly = await discoverCustomSkills()
        expect(customOnly).toHaveLength(1)
        expect(customOnly[0].name).toBe("my-custom-skill")
        expect(customOnly[0].scope).toBe("custom")

        const globalSkills = await discoverOpencodeGlobalSkills()
        const found = globalSkills.find((s) => s.name === "my-custom-skill")
        expect(found).toBeDefined()
        expect(found!.scope).toBe("custom")
      } finally {
        process.env.OPENCODE_CONFIG_DIR = originalEnv
        process.chdir(originalCwd)
        rmSync(testRoot, { recursive: true, force: true })
      }
    })

    it("skill_directories 为相对路径时，相对于 cwd 解析", async () => {
      const testRoot = join(tmpdir(), "skill-loader-custom-rel-" + Date.now())
      const configDir = join(testRoot, "config")
      const customSkillsDir = join(testRoot, "my-skills")
      const skillSubDir = join(customSkillsDir, "rel-skill")
      mkdirSync(configDir, { recursive: true })
      mkdirSync(skillSubDir, { recursive: true })
      writeFileSync(
        join(configDir, "fuyao-opencode.json"),
        JSON.stringify({ skill_directories: ["./my-skills"] }, null, 2)
      )
      writeFileSync(
        join(skillSubDir, "SKILL.md"),
        `---
name: rel-skill
description: Relative path skill
---
# rel-skill
`
      )
      const originalEnv = process.env.OPENCODE_CONFIG_DIR
      const originalCwd = process.cwd()
      process.env.OPENCODE_CONFIG_DIR = configDir
      process.chdir(testRoot)
      try {
        const { discoverCustomSkills } = await import("./loader")
        const skills = await discoverCustomSkills()
        expect(skills).toHaveLength(1)
        expect(skills[0].name).toBe("rel-skill")
      } finally {
        process.env.OPENCODE_CONFIG_DIR = originalEnv
        process.chdir(originalCwd)
        rmSync(testRoot, { recursive: true, force: true })
      }
    })
  })
})
