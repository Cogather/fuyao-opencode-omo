/**
 * Mock data for platform agents (fuyao & agentcenter). Stage one uses mock only;
 * replace with real API calls in adapters when backend is ready.
 * SDK 系统提示词 (system prompt) is also mocked here per app.
 */

import type { PlatformAgentApp } from "./types"

/** Mock system prompt from SDK / platform for fuyao agents. */
const FUYAO_MOCK_SYSTEM_PROMPT = `You are a Fuyao platform agent. Follow user instructions and use available tools. Stay concise and accurate.`

/** Mock system prompt from SDK / platform for agentcenter agents. */
const AGENTCENTER_MOCK_SYSTEM_PROMPT = `You are an AgentCenter platform agent. Assist the user with their requests using the provided tools and context.`

export const MOCK_FUYAO_AGENTS: PlatformAgentApp[] = [
  {
    id: "fuyao-code-helper",
    name: "CodeHelper",
    version: "1.0.0",
    prompt: FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: code generation and refactoring.",
    model: undefined,
    description: "扶摇代码助手（Mock）",
    subagents: ["fuyao:CodeReviewer", "fuyao:TestWriter", "fuyao:RefactorHelper"],
  },
  {
    id: "fuyao-doc-agent",
    name: "DocAgent",
    version: "1.0.0",
    prompt: FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: documentation and comments.",
    description: "扶摇文档助手（Mock）",
    subagents: ["fuyao:DocReviewer"],
  },
  // 子 agent：仅作为主 agent 的子能力被引用
  {
    id: "fuyao-code-reviewer",
    name: "CodeReviewer",
    version: "1.0.0",
    prompt: FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: code review, style and best practices.",
    description: "扶摇代码评审子助手（Mock）",
    mode: "subagent",
  },
  {
    id: "fuyao-test-writer",
    name: "TestWriter",
    version: "1.0.0",
    prompt: FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: unit/integration test generation and coverage.",
    description: "扶摇测试编写子助手（Mock）",
    mode: "subagent",
  },
  {
    id: "fuyao-refactor-helper",
    name: "RefactorHelper",
    version: "1.0.0",
    prompt: FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: safe refactoring and structure improvement.",
    description: "扶摇重构子助手（Mock）",
    mode: "subagent",
  },
  {
    id: "fuyao-doc-reviewer",
    name: "DocReviewer",
    version: "1.0.0",
    prompt: FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: documentation review and clarity.",
    description: "扶摇文档评审子助手（Mock）",
    mode: "subagent",
  },
]

export const MOCK_AGENTCENTER_AGENTS: PlatformAgentApp[] = [
  {
    id: "ac-reviewer",
    name: "Reviewer",
    version: "1.0.0",
    prompt: AGENTCENTER_MOCK_SYSTEM_PROMPT + "\nFocus: code review and suggestions.",
    description: "AgentCenter 评审助手（Mock）",
    subagents: ["agentcenter:StyleChecker", "agentcenter:SecurityScan"],
  },
  {
    id: "ac-qa",
    name: "QAAgent",
    version: "1.0.0",
    prompt: AGENTCENTER_MOCK_SYSTEM_PROMPT + "\nFocus: Q&A and troubleshooting.",
    description: "AgentCenter 问答助手（Mock）",
  },
  // 子 agent
  {
    id: "ac-style-checker",
    name: "StyleChecker",
    version: "1.0.0",
    prompt: AGENTCENTER_MOCK_SYSTEM_PROMPT + "\nFocus: code style and lint suggestions.",
    description: "AgentCenter 风格检查子助手（Mock）",
    mode: "subagent",
  },
  {
    id: "ac-security-scan",
    name: "SecurityScan",
    version: "1.0.0",
    prompt: AGENTCENTER_MOCK_SYSTEM_PROMPT + "\nFocus: security scan and vulnerability hints.",
    description: "AgentCenter 安全扫描子助手（Mock）",
    mode: "subagent",
  },
]
