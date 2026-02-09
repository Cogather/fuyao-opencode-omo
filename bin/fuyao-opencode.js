#!/usr/bin/env node
// bin/fuyao-opencode.js
// Runs the built CLI (dist/cli/index.js). CLI is built for Bun; prefer "bun" when available so npx/bunx works.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "..", "dist", "cli", "index.js");
const args = [scriptPath, ...process.argv.slice(2)];

// CLI bundle is built with --target bun; run with Bun when available to avoid __require errors under Node
const bunCheck = spawnSync("bun", ["--version"], { encoding: "utf8", stdio: "pipe" });
const useBun = bunCheck.status === 0 && bunCheck.stdout && String(bunCheck.stdout).trim().length > 0;
const runner = useBun ? "bun" : process.execPath;

const result = spawnSync(runner, args, { stdio: "inherit" });

if (result.error) {
  console.error(`\nfuyao-opencode: Failed to run CLI: ${result.error.message}\n`);
  if (!useBun) {
    console.error("The CLI is built for Bun. Install Bun and run: bun x fuyao-opencode <command>\n");
  }
  process.exit(2);
}
if (result.signal) {
  const code = result.signal === "SIGTERM" ? 128 + 15 : result.signal === "SIGINT" ? 128 + 2 : 1;
  process.exit(code);
}
process.exit(result.status ?? 1);
