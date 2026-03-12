#!/usr/bin/env node
/**
 * 设计文档第 9 章：打包并集成到 OpenCode
 * 在项目根执行 bun run integrate 后，本脚本输出配置目录与后续命令。
 */

import { platform } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");

function getConfigDir() {
  if (process.env.OPENCODE_CONFIG_DIR) return process.env.OPENCODE_CONFIG_DIR;
  const home = process.env.USERPROFILE || process.env.HOME || "~";
  if (platform() === "win32") return `${home}\\.config\\opencode`;
  return `${home}/.config/opencode`;
}

const configDir = getConfigDir();
const fileUri = "file:" + projectRoot.replace(/\\/g, "/");

console.log("");
console.log("--- fuyao-opencode 已构建，集成到 OpenCode 的后续步骤 ---");
console.log("");
console.log("1. OpenCode 配置目录: " + configDir);
console.log("2. 在配置目录安装/刷新插件（若已用 file: 指向本仓库，执行一次 install 即可拉取最新构建）:");
console.log("");
console.log("   cd " + JSON.stringify(configDir));
console.log("   bun install");
console.log("   # 若报错 EBUSY，请先关闭 OpenCode 再执行 bun install");
console.log("");
console.log("3. 若尚未声明插件，请在 opencode.jsonc 的 plugin 数组中加入: \"fuyao-opencode\"");
console.log("   若尚未用 file: 安装，可执行: bun add " + JSON.stringify(fileUri));
console.log("");
console.log("4. 启动 OpenCode，发一条消息后关闭并重新打开，agent 即会出现在列表。");
console.log("");
