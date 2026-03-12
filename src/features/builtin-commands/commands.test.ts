/**
 * Builtin commands registration tests (design doc 6.1 F11).
 */

import { describe, test, expect } from "bun:test"
import { loadBuiltinCommands } from "./commands"

describe("builtin commands (design doc 6.1 F11)", () => {
  test("loadBuiltinCommands includes platform-publish and platform-sync when not disabled", () => {
    const commands = loadBuiltinCommands()
    expect(commands["platform-publish"]).toBeDefined()
    expect(commands["platform-sync"]).toBeDefined()
    expect(commands["platform-publish"].name).toBe("platform-publish")
    expect(commands["platform-sync"].name).toBe("platform-sync")
  })

  test("loadBuiltinCommands excludes platform-publish when in disabled_commands", () => {
    const commands = loadBuiltinCommands(["platform-publish"])
    expect(commands["platform-publish"]).toBeUndefined()
    expect(commands["platform-sync"]).toBeDefined()
  })

  test("loadBuiltinCommands excludes platform-sync when in disabled_commands", () => {
    const commands = loadBuiltinCommands(["platform-sync"])
    expect(commands["platform-sync"]).toBeUndefined()
    expect(commands["platform-publish"]).toBeDefined()
  })
})
