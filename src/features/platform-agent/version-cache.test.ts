/**
 * Tests for version-cache (design doc 6.3: version-cache 文件损坏 returns {}).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  getCacheFilePath,
  readVersionCache,
  writeVersionCache,
  type VersionCacheMap,
} from "./version-cache"

describe("version-cache (design doc 6.3)", () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `platform-agent-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    try {
      if (dir && existsSync(dir)) rmSync(dir, { recursive: true })
    } catch {
      // ignore
    }
  })

  test("getCacheFilePath returns path with platform suffix", () => {
    // #given
    const platform = "fuyao"

    // #when
    const path = getCacheFilePath(platform, dir)

    // #then
    expect(path).toContain(".platform-agent-cache-fuyao.json")
    expect(path).toContain(dir)
  })

  test("readVersionCache returns {} when file missing", () => {
    // #given - no file

    // #when
    const out = readVersionCache("fuyao", dir)

    // #then
    expect(out).toEqual({})
  })

  test("readVersionCache returns {} when file corrupted (design doc 6.3)", () => {
    // #given - corrupted file
    const path = getCacheFilePath("fuyao", dir)
    writeFileSync(path, "not valid json {{{", "utf-8")

    // #when
    const out = readVersionCache("fuyao", dir)

    // #then
    expect(out).toEqual({})
  })

  test("readVersionCache returns {} when file is empty array", () => {
    // #given - invalid shape (array)
    const path = getCacheFilePath("agentcenter", dir)
    writeFileSync(path, "[]", "utf-8")

    // #when
    const out = readVersionCache("agentcenter", dir)

    // #then
    expect(out).toEqual({})
  })

  test("writeVersionCache and readVersionCache roundtrip", () => {
    // #given
    const versions: VersionCacheMap = { CodeHelper: "1.0.0", DocAgent: "2.0.0" }

    // #when
    writeVersionCache("fuyao", versions, dir)
    const read = readVersionCache("fuyao", dir)

    // #then
    expect(read).toEqual(versions)
  })
})
