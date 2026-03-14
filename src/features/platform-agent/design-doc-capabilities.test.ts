/**
 * 设计文档 6.5 I4、6.4 C1 能力测试：工具注册与 schema。
 * 与 version-cache / config-bridge / api / platform-agent-functional / commands / persist-agent-skill 一起构成设计文档能力测试集。
 */

import { describe, test, expect } from "bun:test"
import { createPlatformAgentPublishTool } from "../../tools/platform-agent-publish"
import { createPlatformAgentSyncTool } from "../../tools/platform-agent-sync"
import { createPlatformListToolsTool } from "../../tools/platform-list-tools"
import { createPlatformInvokeToolTool } from "../../tools/platform-invoke-tool"
import { createSkillInjectToAgentTool } from "../../tools/skill-inject-to-agent"
import { OhMyOpenCodeConfigSchema } from "../../config/schema"

describe("Design doc 6.5 I4 - tool 注册", () => {
  test("platform_agent_publish、platform_agent_sync、platform_list_tools、platform_invoke_tool、skill_inject_to_agent 均存在且 execute 可调用", () => {
    const dir = process.cwd()
    const pluginConfig = { platform_agent: { enabled: true, platforms: ["fuyao"] } }
    const publishTool = createPlatformAgentPublishTool({ directory: dir, pluginConfig } as any)
    const syncTool = createPlatformAgentSyncTool({ directory: dir, pluginConfig } as any)
    const listToolsTool = createPlatformListToolsTool()
    const invokeToolTool = createPlatformInvokeToolTool()
    const skillInjectTool = createSkillInjectToAgentTool()

    const tools = {
      platform_agent_publish: publishTool,
      platform_agent_sync: syncTool,
      platform_list_tools: listToolsTool,
      platform_invoke_tool: invokeToolTool,
      skill_inject_to_agent: skillInjectTool,
    }
    expect(tools.platform_agent_publish).toBeDefined()
    expect(tools.platform_agent_sync).toBeDefined()
    expect(tools.platform_list_tools).toBeDefined()
    expect(tools.platform_invoke_tool).toBeDefined()
    expect(tools.skill_inject_to_agent).toBeDefined()
    expect(typeof tools.platform_agent_publish.execute).toBe("function")
    expect(typeof tools.platform_agent_sync.execute).toBe("function")
    expect(typeof tools.platform_list_tools.execute).toBe("function")
    expect(typeof tools.platform_invoke_tool.execute).toBe("function")
    expect(typeof tools.skill_inject_to_agent.execute).toBe("function")
  })
})

describe("Design doc 6.4 C1 - schema platform_agent、default_agent、agents catchall", () => {
  test("PlatformAgentConfigSchema：enabled、platforms 解析正确", () => {
    const config = {
      platform_agent: { enabled: true, platforms: ["fuyao", "agentcenter"] },
      default_agent: "sisyphus",
      agents: {
        "fuyao:CodeHelper": { prompt: "Help", subagents: ["fuyao:Other"], mcps: ["mcp1"] },
      },
    }
    const result = OhMyOpenCodeConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.platform_agent?.enabled).toBe(true)
      expect(result.data.platform_agent?.platforms).toEqual(["fuyao", "agentcenter"])
      expect(result.data.default_agent).toBe("sisyphus")
      expect(result.data.agents?.["fuyao:CodeHelper"]).toBeDefined()
      expect((result.data.agents as any)["fuyao:CodeHelper"].prompt).toBe("Help")
      expect((result.data.agents as any)["fuyao:CodeHelper"].subagents).toEqual(["fuyao:Other"])
    }
  })
})
