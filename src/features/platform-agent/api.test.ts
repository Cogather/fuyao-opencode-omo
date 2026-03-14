/**
 * Platform agent API tests (design doc 6.1 F12 - getPlatformAgentDetail).
 */

import { describe, test, expect } from "bun:test"
import { getPlatformAgentList, getPlatformAgentDetail, getPlatformAgentToolSets, invokePlatformTool } from "./api"

describe("platform-agent api (design doc 6.1 F12)", () => {
  test("getPlatformAgentList returns list for fuyao and agentcenter", async () => {
    const fuyao = await getPlatformAgentList("fuyao")
    expect(Array.isArray(fuyao)).toBe(true)
    expect(fuyao.some((a) => a.name === "CodeHelper")).toBe(true)

    const ac = await getPlatformAgentList("agentcenter")
    expect(Array.isArray(ac)).toBe(true)
  })

  test("getPlatformAgentDetail by id returns single app or null", async () => {
    const byId = await getPlatformAgentDetail("fuyao", { id: "fuyao-code-helper" })
    expect(byId).not.toBeNull()
    expect(byId!.name).toBe("CodeHelper")

    const missing = await getPlatformAgentDetail("fuyao", { id: "nonexistent-id" })
    expect(missing).toBeNull()
  })

  test("getPlatformAgentDetail by name returns single app", async () => {
    const byName = await getPlatformAgentDetail("fuyao", { name: "DocAgent" })
    expect(byName).not.toBeNull()
    expect(byName!.name).toBe("DocAgent")

    const withVersion = await getPlatformAgentDetail("fuyao", {
      name: "CodeHelper",
      version: "1.0.0",
    })
    expect(withVersion).not.toBeNull()
    expect(withVersion!.version).toBe("1.0.0")
  })

  test("getPlatformAgentToolSets returns toolSet/agentToolSet/workflowToolSet for agent with tools", async () => {
    const sets = await getPlatformAgentToolSets("fuyao", "CodeHelper")
    expect(sets.toolSet.length).toBeGreaterThan(0)
    expect(sets.toolSet.some((t) => t.toolId === "fuyao-code-gen")).toBe(true)
    expect(sets.workflowToolSet.some((t) => t.toolId === "fuyao-pipeline-validate")).toBe(true)
  })

  test("invokePlatformTool calls adapter and returns result", async () => {
    const result = await invokePlatformTool("fuyao", {
      agentName: "CodeHelper",
      toolId: "fuyao-code-gen",
      toolType: "toolSet",
      arguments: { input: "test" },
    })
    expect(result.success).toBe(true)
    expect(result.output).toContain("fuyao-code-gen")
    expect(result.output).toContain("toolSet")
  })
})
