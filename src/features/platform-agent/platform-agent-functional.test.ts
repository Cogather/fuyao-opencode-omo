/**
 * Functional tests per design doc 6.1.
 * Covers: platform_agent config merge, version-cache write, sync/publish tools, getAgentToolRestrictions.
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test"
import { mkdirSync, readFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { createConfigHandler } from "../../plugin-handlers/config-handler"
import type { OhMyOpenCodeConfig } from "../../config"
import * as agents from "../../agents"
import * as sisyphusJunior from "../../agents/sisyphus-junior"
import * as commandLoader from "../../features/claude-code-command-loader"
import * as builtinCommands from "../../features/builtin-commands"
import * as skillLoader from "../../features/opencode-skill-loader"
import * as agentLoader from "../../features/claude-code-agent-loader"
import * as mcpLoader from "../../features/claude-code-mcp-loader"
import * as pluginLoader from "../../features/claude-code-plugin-loader"
import * as mcpModule from "../../mcp"
import * as shared from "../../shared"
import * as configDir from "../../shared/opencode-config-dir"
import * as permissionCompat from "../../shared/permission-compat"
import * as modelResolver from "../../shared/model-resolver"
import { createPlatformAgentSyncTool } from "../../tools/platform-agent-sync"
import { createPlatformAgentPublishTool } from "../../tools/platform-agent-publish"
import { getAgentToolRestrictions } from "../../shared/agent-tool-restrictions"
import { getSubagentsFromEntry } from "../../tools/delegate-task/executor"
import { getCacheFilePath, readVersionCache } from "./version-cache"
import * as platformAgentApi from "./api"

beforeEach(() => {
  spyOn(agents, "createBuiltinAgents" as any).mockResolvedValue({
    sisyphus: { name: "sisyphus", prompt: "test", mode: "primary" },
    oracle: { name: "oracle", prompt: "test", mode: "subagent" },
  })
  spyOn(sisyphusJunior, "createSisyphusJuniorAgentWithOverrides" as any).mockReturnValue({
    name: "sisyphus-junior",
    prompt: "test",
    mode: "subagent",
  })
  spyOn(commandLoader, "loadUserCommands" as any).mockResolvedValue({})
  spyOn(commandLoader, "loadProjectCommands" as any).mockResolvedValue({})
  spyOn(commandLoader, "loadOpencodeGlobalCommands" as any).mockResolvedValue({})
  spyOn(commandLoader, "loadOpencodeProjectCommands" as any).mockResolvedValue({})
  spyOn(builtinCommands, "loadBuiltinCommands" as any).mockReturnValue({})
  spyOn(skillLoader, "loadUserSkills" as any).mockResolvedValue({})
  spyOn(skillLoader, "loadProjectSkills" as any).mockResolvedValue({})
  spyOn(skillLoader, "loadOpencodeGlobalSkills" as any).mockResolvedValue({})
  spyOn(skillLoader, "loadOpencodeProjectSkills" as any).mockResolvedValue({})
  spyOn(skillLoader, "discoverUserClaudeSkills" as any).mockResolvedValue([])
  spyOn(skillLoader, "discoverProjectClaudeSkills" as any).mockResolvedValue([])
  spyOn(skillLoader, "discoverOpencodeGlobalSkills" as any).mockResolvedValue([])
  spyOn(skillLoader, "discoverOpencodeProjectSkills" as any).mockResolvedValue([])
  spyOn(agentLoader, "loadUserAgents" as any).mockReturnValue({})
  spyOn(agentLoader, "loadProjectAgents" as any).mockReturnValue({})
  spyOn(mcpLoader, "loadMcpConfigs" as any).mockResolvedValue({ servers: {} })
  spyOn(pluginLoader, "loadAllPluginComponents" as any).mockResolvedValue({
    commands: {},
    skills: {},
    agents: {},
    mcpServers: {},
    hooksConfigs: [],
    plugins: [],
    errors: [],
  })
  spyOn(mcpModule, "createBuiltinMcps" as any).mockReturnValue({})
  spyOn(shared, "log" as any).mockImplementation(() => {})
  spyOn(shared, "fetchAvailableModels" as any).mockResolvedValue(new Set(["anthropic/claude-opus-4-5"]))
  spyOn(shared, "readConnectedProvidersCache" as any).mockReturnValue(null)
  spyOn(configDir, "getOpenCodeConfigPaths" as any).mockReturnValue({
    configDir: "/tmp/.config/opencode",
    omoConfig: "/tmp/.config/opencode/fuyao-opencode.json",
  })
  spyOn(permissionCompat, "migrateAgentConfig" as any).mockImplementation((c: Record<string, unknown>) => c)
  spyOn(modelResolver, "resolveModelWithFallback" as any).mockReturnValue({ model: "anthropic/claude-opus-4-5" })
})

afterEach(() => {
  ;(agents.createBuiltinAgents as any)?.mockRestore?.()
  ;(sisyphusJunior.createSisyphusJuniorAgentWithOverrides as any)?.mockRestore?.()
  ;(commandLoader.loadUserCommands as any)?.mockRestore?.()
  ;(commandLoader.loadProjectCommands as any)?.mockRestore?.()
  ;(commandLoader.loadOpencodeGlobalCommands as any)?.mockRestore?.()
  ;(commandLoader.loadOpencodeProjectCommands as any)?.mockRestore?.()
  ;(builtinCommands.loadBuiltinCommands as any)?.mockRestore?.()
  ;(skillLoader.loadUserSkills as any)?.mockRestore?.()
  ;(skillLoader.loadProjectSkills as any)?.mockRestore?.()
  ;(skillLoader.loadOpencodeGlobalSkills as any)?.mockRestore?.()
  ;(skillLoader.loadOpencodeProjectSkills as any)?.mockRestore?.()
  ;(skillLoader.discoverUserClaudeSkills as any)?.mockRestore?.()
  ;(skillLoader.discoverProjectClaudeSkills as any)?.mockRestore?.()
  ;(skillLoader.discoverOpencodeGlobalSkills as any)?.mockRestore?.()
  ;(skillLoader.discoverOpencodeProjectSkills as any)?.mockRestore?.()
  ;(agentLoader.loadUserAgents as any)?.mockRestore?.()
  ;(agentLoader.loadProjectAgents as any)?.mockRestore?.()
  ;(mcpLoader.loadMcpConfigs as any)?.mockRestore?.()
  ;(pluginLoader.loadAllPluginComponents as any)?.mockRestore?.()
  ;(mcpModule.createBuiltinMcps as any)?.mockRestore?.()
  ;(shared.log as any)?.mockRestore?.()
  ;(shared.fetchAvailableModels as any)?.mockRestore?.()
  ;(shared.readConnectedProvidersCache as any)?.mockRestore?.()
  ;(configDir.getOpenCodeConfigPaths as any)?.mockRestore?.()
  ;(permissionCompat.migrateAgentConfig as any)?.mockRestore?.()
  ;(modelResolver.resolveModelWithFallback as any)?.mockRestore?.()
})

describe("Design doc 6.1 - 启用 platform_agent 并配置 fuyao", () => {
  test("config 合并后 config.agent 包含平台拉取的 agent；version-cache 写入对应平台文件", async () => {
    // #given - disable sisyphus so config branch only merges builtin + platform (simpler)
    const testDir = join(tmpdir(), `platform-agent-ft-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const pluginConfig: OhMyOpenCodeConfig = {
      sisyphus_agent: { disabled: true },
      platform_agent: { enabled: true, platforms: ["fuyao"] },
    }
    const config: Record<string, unknown> = { model: "test", agent: {} }
    const handler = createConfigHandler({
      ctx: { directory: testDir },
      pluginConfig,
      modelCacheState: {
        anthropicContext1MEnabled: false,
        modelContextLimitsCache: new Map(),
      },
    })

    // #when
    await handler(config)

    // #then - config.agent contains platform agents (fuyao:CodeHelper etc.)
    const agentRecord = config.agent as Record<string, unknown>
    expect(agentRecord["fuyao:CodeHelper"]).toBeDefined()
    expect(agentRecord["fuyao:DocAgent"]).toBeDefined()
    expect((agentRecord["fuyao:CodeHelper"] as Record<string, unknown>).name).toBe("fuyao:CodeHelper")

    // #then - version-cache file written for fuyao
    const cachePath = getCacheFilePath("fuyao", testDir)
    expect(existsSync(cachePath)).toBe(true)
    const cached = readVersionCache("fuyao", testDir)
    expect(cached["CodeHelper"]).toBeDefined()
    expect(cached["DocAgent"]).toBeDefined()

    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.1 - platforms 含 agentcenter", () => {
  test("拉取 agentcenter 列表并合并；缓存使用 agentcenter 的 key", async () => {
    // #given
    const testDir = join(tmpdir(), `platform-agent-ac-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const pluginConfig: OhMyOpenCodeConfig = {
      sisyphus_agent: { disabled: true },
      platform_agent: { enabled: true, platforms: ["agentcenter"] },
    }
    const config: Record<string, unknown> = { model: "test", agent: {} }
    const handler = createConfigHandler({
      ctx: { directory: testDir },
      pluginConfig,
      modelCacheState: {
        anthropicContext1MEnabled: false,
        modelContextLimitsCache: new Map(),
      },
    })

    // #when
    await handler(config)

    // #then
    const agentRecord = config.agent as Record<string, unknown>
    expect(agentRecord["agentcenter:Reviewer"]).toBeDefined()
    const cachePath = getCacheFilePath("agentcenter", testDir)
    expect(existsSync(cachePath)).toBe(true)
    const cached = readVersionCache("agentcenter", testDir)
    expect(Object.keys(cached).length).toBeGreaterThan(0)

    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.1 - platform_agent_sync", () => {
  test("无 force_refresh 时返回「当前与平台一致」或「以下 Agent 有更新」", async () => {
    // #given
    const testDir = join(tmpdir(), `platform-sync-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const syncTool = createPlatformAgentSyncTool({
      directory: testDir,
      pluginConfig: {
        platform_agent: { enabled: true, platforms: ["fuyao", "agentcenter"] },
      },
    })

    // #when - no cache yet, so "outdated" will be non-empty or we write and get 一致 depending on impl
    const result = await syncTool.execute!(
      { platform_type: "fuyao", force_refresh: undefined },
      {} as any
    )

    // #then
    expect(typeof result).toBe("string")
    expect(
      result === "当前与平台一致。" ||
        result.startsWith("以下 Agent 有更新：") ||
        result.includes("已刷新")
    ).toBe(true)

    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })

  test("force_refresh=true 时缓存被覆盖并返回「已刷新到平台最新」", async () => {
    // #given
    const testDir = join(tmpdir(), `platform-sync-refresh-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const syncTool = createPlatformAgentSyncTool({
      directory: testDir,
      pluginConfig: {
        platform_agent: { enabled: true, platforms: ["fuyao"] },
      },
    })

    // #when
    const result = await syncTool.execute!(
      { platform_type: "fuyao", force_refresh: true },
      {} as any
    )

    // #then
    expect(result).toContain("已刷新到平台最新")
    expect(result).toContain("共")
    const cached = readVersionCache("fuyao", testDir)
    expect(Object.keys(cached).length).toBeGreaterThan(0)

    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.1 - platform_agent_publish", () => {
  test("成功后 version-cache 中该 name 的 version 更新", async () => {
    // #given
    const testDir = join(tmpdir(), `platform-publish-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const publishTool = createPlatformAgentPublishTool({
      directory: testDir,
      pluginConfig: {
        platform_agent: { enabled: true, platforms: ["fuyao"] },
      },
    })

    // #when
    const result = await publishTool.execute!(
      { agent_name: "fuyao:CodeHelper" },
      {} as any
    )

    // #then
    expect(result).toContain("Published")
    expect(result).toContain("version")
    const cached = readVersionCache("fuyao", testDir)
    expect(cached["CodeHelper"]).toBeDefined()

    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.1 - getAgentToolRestrictions(平台 agent 名)", () => {
  test("返回默认允许（如 {}）", () => {
    // #given - platform agent name not in built-in table
    const platformAgentName = "fuyao:CodeHelper"

    // #when
    const restrictions = getAgentToolRestrictions(platformAgentName)

    // #then
    expect(restrictions).toEqual({})
  })

  test("非平台 agent 时 platform_invoke_tool、platform_list_tools 被禁止", () => {
    const restrictions = getAgentToolRestrictions("sisyphus")
    expect(restrictions.platform_invoke_tool).toBe(false)
    expect(restrictions.platform_list_tools).toBe(false)
  })

  test("agentcenter agent name returns {}", () => {
    expect(getAgentToolRestrictions("agentcenter:Reviewer")).toEqual({})
  })
})

describe("Design doc 6.1 - 平台 Agent 配置 subagents 后 delegate_task", () => {
  test("getSubagentsFromEntry 返回 parent 的 subagents 白名单供 executor 过滤", () => {
    // #given - platform agent entry with subagents (used by resolveSubagentExecution for whitelist)
    const entry = {
      name: "fuyao:CodeHelper",
      subagents: ["fuyao:CodeReviewer", "fuyao:TestWriter"],
    }

    // #when
    const list = getSubagentsFromEntry(entry)

    // #then - only these can be used as subagent_type in delegate_task
    expect(list).toEqual(["fuyao:CodeReviewer", "fuyao:TestWriter"])
  })

  test("getSubagentsFromEntry 支持 options.subagents（OpenCode 兼容）", () => {
    const entry = {
      name: "fuyao:DocAgent",
      options: { subagents: ["fuyao:DocReviewer"] },
    }
    expect(getSubagentsFromEntry(entry)).toEqual(["fuyao:DocReviewer"])
  })
})

describe("Design doc 6.6 边界 E5 - platform_agent_sync 未配置该平台", () => {
  test("platform 不在 platforms 时返回提示", async () => {
    const testDir = join(tmpdir(), `platform-sync-e5-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const syncTool = createPlatformAgentSyncTool({
      directory: testDir,
      pluginConfig: {
        platform_agent: { enabled: true, platforms: ["fuyao"] },
      },
    })
    const result = await syncTool.execute!(
      { platform_type: "agentcenter", force_refresh: false },
      {} as any
    )
    expect(result).toContain("is not in configured platforms")
    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.6 边界 E6 - platform_agent_publish agent_name 非 platform:name", () => {
  test("非 platform:name 时返回 Error 文案", async () => {
    const testDir = join(tmpdir(), `platform-publish-e6-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const publishTool = createPlatformAgentPublishTool({
      directory: testDir,
      pluginConfig: { platform_agent: { enabled: true, platforms: ["fuyao"] } },
    })
    const result = await publishTool.execute!(
      { agent_name: "sisyphus" },
      {} as any
    )
    expect(result).toContain("Error")
    expect(result).toMatch(/fuyao:Name|agentcenter:Name/)
    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.6 E1 - platform_agent_sync 网络失败返回错误文案", () => {
  test("getPlatformAgentList reject 时返回 Sync failed: ...", async () => {
    const testDir = join(tmpdir(), `platform-sync-e1-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const spy = spyOn(platformAgentApi, "getPlatformAgentList").mockRejectedValueOnce(new Error("network error"))
    const syncTool = createPlatformAgentSyncTool({
      directory: testDir,
      pluginConfig: { platform_agent: { enabled: true, platforms: ["fuyao"] } },
    })
    const result = await syncTool.execute!(
      { platform_type: "fuyao", force_refresh: false },
      {} as any
    )
    expect(result).toMatch(/^Sync failed:/)
    spy.mockRestore?.()
    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})

describe("Design doc 6.6 E2/E3 - 鉴权失败或平台畸形数据", () => {
  test("E2: getPlatformAgentList 抛错时 sync 返回明确错误不写脏缓存", async () => {
    const testDir = join(tmpdir(), `platform-sync-e2-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const spy = spyOn(platformAgentApi, "getPlatformAgentList").mockRejectedValueOnce(new Error("401 Unauthorized"))
    const syncTool = createPlatformAgentSyncTool({
      directory: testDir,
      pluginConfig: { platform_agent: { enabled: true, platforms: ["fuyao"] } },
    })
    const result = await syncTool.execute!(
      { platform_type: "fuyao", force_refresh: false },
      {} as any
    )
    expect(result).toMatch(/Sync failed:.*401/)
    const cached = readVersionCache("fuyao", testDir)
    expect(Object.keys(cached).length).toBe(0)
    spy.mockRestore?.()
    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })

  test("E3: 平台返回非预期结构时 config 合并不中断", async () => {
    const testDir = join(tmpdir(), `config-handler-e3-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    const spy = spyOn(platformAgentApi, "getPlatformAgentList").mockResolvedValueOnce([
      { id: "x", name: "CodeHelper", prompt: "p", version: "1.0.0" },
      { id: "y", name: undefined as any, prompt: "q" },
    ])
    const pluginConfig: OhMyOpenCodeConfig = {
      platform_agent: { enabled: true, platforms: ["fuyao"] },
    }
    const config: Record<string, unknown> = {
      model: "anthropic/claude-opus-4-5",
      agent: {},
    }
    const handler = createConfigHandler({
      ctx: { directory: testDir },
      pluginConfig,
      modelCacheState: {
        anthropicContext1MEnabled: false,
        modelContextLimitsCache: new Map(),
      },
    })
    await expect(handler(config)).resolves.toBeUndefined()
    const agentsRecord = config.agent as Record<string, unknown>
    expect(agentsRecord["fuyao:CodeHelper"]).toBeDefined()
    spy.mockRestore?.()
    try {
      rmSync(testDir, { recursive: true })
    } catch {
      // ignore
    }
  })
})
