/**
 * Config-bridge unit tests (design doc 6.2 V5, V6).
 */

import { describe, test, expect } from "bun:test"
import {
  platformAppToOpenCodeAgent,
  platformAppsToAgentRecord,
  openCodeAgentToPlatformApp,
  type OpenCodeAgentEntry,
} from "./config-bridge"
import type { PlatformAgentApp } from "./types"

describe("config-bridge (design doc 6.2 V5, V6)", () => {
  describe("platformAppToOpenCodeAgent", () => {
    test("entry.name equals config key platform:name", () => {
      const app: PlatformAgentApp = {
        id: "id-1",
        name: "CodeHelper",
        version: "1.0.0",
        prompt: "You are a helper.",
        description: "Code helper",
      }
      const entry = platformAppToOpenCodeAgent(app, "fuyao")
      expect(entry.name).toBe("fuyao:CodeHelper")
    })

    test("writes prompt, description, model, permission, skills, mcps, subagents, mode", () => {
      const app: PlatformAgentApp = {
        id: "id-2",
        name: "Reviewer",
        version: "2.0.0",
        prompt: "You review code.",
        model: "gpt-5",
        permission: { delegate_task: "allow" },
        skills: ["skill-a"],
        mcps: ["mcp-1"],
        subagents: ["agentcenter:Helper"],
        mode: "all",
        description: "Review agent",
      }
      const entry = platformAppToOpenCodeAgent(app, "agentcenter")
      expect(entry.name).toBe("agentcenter:Reviewer")
      expect(entry.prompt).toBe("You review code.")
      expect(entry.description).toBe("Review agent")
      expect(entry.model).toBe("gpt-5")
      expect(entry.permission).toEqual({ delegate_task: "allow" })
      expect(entry.skills).toEqual(["skill-a"])
      expect(entry.mcps).toEqual(["mcp-1"])
      expect(entry.subagents).toEqual(["agentcenter:Helper"])
      expect(entry.mode).toBe("all")
    })
  })

  describe("platformAppsToAgentRecord", () => {
    test("builds record with keys platform:name for each app", () => {
      const apps: PlatformAgentApp[] = [
        { id: "a", name: "A", prompt: "p1" },
        { id: "b", name: "B", prompt: "p2" },
      ]
      const record = platformAppsToAgentRecord(apps, "fuyao")
      expect(record["fuyao:A"]).toBeDefined()
      expect(record["fuyao:B"]).toBeDefined()
      expect((record["fuyao:A"] as OpenCodeAgentEntry).name).toBe("fuyao:A")
    })
  })

  describe("openCodeAgentToPlatformApp", () => {
    test("converts entry with platform:name to PlatformAgentApp", () => {
      const entry: OpenCodeAgentEntry = {
        name: "fuyao:CodeHelper",
        prompt: "Custom prompt",
        description: "Desc",
        version: "1.0.0",
        model: "claude-4",
        skills: ["s1"],
        mcps: ["m1"],
        subagents: ["fuyao:Other"],
      }
      const app = openCodeAgentToPlatformApp(entry, "fuyao")
      expect(app.name).toBe("CodeHelper")
      expect(app.prompt).toBe("Custom prompt")
      expect(app.description).toBe("Desc")
      expect(app.version).toBe("1.0.0")
      expect(app.model).toBe("claude-4")
      expect(app.skills).toEqual(["s1"])
      expect(app.mcps).toEqual(["m1"])
      expect(app.subagents).toEqual(["fuyao:Other"])
    })

    test("entry without colon in name uses name as appName", () => {
      const entry: OpenCodeAgentEntry = { name: "CodeHelper", prompt: "p" }
      const app = openCodeAgentToPlatformApp(entry, "fuyao")
      expect(app.name).toBe("CodeHelper")
    })
  })
})
