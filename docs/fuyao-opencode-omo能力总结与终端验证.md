# fuyao-opencode-omo 能力总结与 OpenCode 终端验证指南

本文档汇总当前项目具备的能力，并说明**如何在 OpenCode 终端/聊天窗口中触发**以验证各功能。

---

## 一、能力总览

### 1. 多模型与多 Agent 编排（OMO 基础）

| 能力 | 说明 |
|------|------|
| **11 个内置 Agent** | Sisyphus（主编排）、Hephaestus（深度执行）、Atlas（编排）、Prometheus（规划）、Oracle、librarian、explore、multimodal-looker、sisyphus-junior 等，支持多模型降级与 Claude Code 兼容。 |
| **34 个生命周期 Hook** | 会话恢复、Ralph Loop、Atlas 编排、Todo 续写、自动更新检查、关键词检测等。 |
| **20+ Tools** | LSP、AST-Grep、delegate_task、call_omo_agent、skill、list_available_skills、list_available_subagents、platform_agent_publish、platform_agent_sync、**platform_list_tools**、**platform_invoke_tool**、skill_inject_to_agent 等。 |

### 2. 平台 Agent 对接（扶摇 / AgentCenter）

| 能力 | 说明 |
|------|------|
| **动态拉取平台 Agent** | 启动/刷新时从配置的 `platform_agent.platforms`（fuyao / agentcenter）拉取应用列表，合并进 OpenCode 的 agent 列表；当前为 **Mock 数据**，真实对接后替换适配器。 |
| **平台下发的 skill/MCP 定义合并** | 平台应用可带 `skill_definitions`、`mcp_definitions`；拉取时自动合并进 `config.command`、`config.mcp`，无需本地或市场已有同名项即可使用（Mock 中 CodeHelper 等已带示例）。 |
| **平台 Agent 与主/子 Agent 一致使用** | 平台 Agent 以 `fuyao:CodeHelper`、`agentcenter:Reviewer` 等形式出现在 Agent 列表，可与内置 Agent 一样被选中、发消息、使用 skill/MCP。 |
| **用户覆盖** | 在配置 `agents` 中手写 `fuyao:CodeHelper` 等 key，可覆盖平台拉取的 prompt、skills、mcps、subagents。 |
| **发布到平台** | 将当前本地配置（含 prompt、skills、mcps、subagents）发布/更新到平台（当前 Mock 成功）。平台应用详情可含 **managers**（管理员名单）；配置 **platform_agent.publish_identity** 为当前用户身份后，仅名单内人员可发布，其他人可本地修改但不能发布。 |
| **同步与版本比对** | 拉取平台列表与本地 version-cache 比对，支持 force_refresh 覆盖缓存；有更新时通过 Toast 或同步返回文案提示。 |
| **Subagent 白名单** | 平台 Agent 可配置 subagents；delegate_task 仅能调用该白名单内的 agent，实现 A→B→C 多层调用。 |
| **平台独有工具（toolSet/agentToolSet/workflowToolSet）** | 平台应用详情可带 tool_set、agent_tool_set、workflow_tool_set；拉取后写入 platform-tool-registry。平台 Agent 可调用 **platform_list_tools** 查看可用 toolId 与描述，再通过 **platform_invoke_tool** 传入 tool_id、tool_type、arguments 执行；非平台 Agent 不可见上述两工具。适配器 invokeTool 当前为 Mock。 |

### 3. 内置命令（Slash Commands）

| 命令 | 说明 |
|------|------|
| **/init-deep** | 初始化/更新层级 AGENTS.md 知识库；可选 `--create-new`、`--max-depth=N`。 |
| **/ralph-loop** | 启动自指开发循环直到完成；可带任务描述、`--completion-promise`、`--max-iterations`。 |
| **/ulw-loop** | 类 Ralph，ultrawork 模式。 |
| **/cancel-ralph** | 取消当前 Ralph Loop。 |
| **/refactor** | 智能重构（LSP、AST-grep、架构分析）；可带 `--scope`、`--strategy=safe|aggressive`。 |
| **/start-work** | 从 Prometheus 计划启动 Sisyphus 工作会话。 |
| **/stop-continuation** | 停止当前会话的 ralph loop、todo 续写、boulder 等延续机制。 |
| **/platform-publish** | 发布或更新平台 Agent 到平台（引导使用 platform_agent_publish tool，agent_name 需为 `fuyao:xxx` 或 `agentcenter:xxx`）。 |
| **/platform-sync** | 同步平台 Agent 版本、比对缓存；可带 platform_type、`--force-refresh`。 |

### 4. 默认 Agent 与持久化

| 能力 | 说明 |
|------|------|
| **default_agent** | 配置项指定启动时默认选中的 agent（如 `sisyphus`、`fuyao:CodeHelper`）。 |
| **persistDefaultAgent** | 主会话下用户发消息时，将当前选中的 agent 写回配置文件，下次启动沿用。 |

### 5. Skill 市场与注入

| 能力 | 说明 |
|------|------|
| **Skill 市场列表/下载** | 获取市场 skill 列表（当前 Mock）、按 id 下载到 `configDir/skills/market/<skillId>/`。 |
| **skill_inject_to_agent** | 将指定市场 skill 注入到某 agent 的 skills 配置并写回 OMO 配置；agent 可为内置（如 sisyphus）或平台（如 fuyao:CodeHelper）。 |
| **市场 skill 被发现** | `discoverOpencodeGlobalSkills` 会扫描 `skills/market` 下子目录，市场 skill 进入 config.command 供 agent 使用。 |
| **自定义 Skill 目录** | 配置 `skill_directories: ["路径1", "路径2"]` 后，这些目录会被扫描（一层子目录，SKILL.md 或 {name}.md）；路径相对 cwd 解析，scope 为 custom，与现有 5 类目录一并参与发现与可用列表。 |

### 6. 配置与安装

| 能力 | 说明 |
|------|------|
| **platform_agent / default_agent 配置** | Schema 支持 `platform_agent: { enabled, platforms, publish_identity? }`、`default_agent`；install 时默认写入。`publish_identity` 为当前用户身份（如平台用户 id 或邮箱），用于与应用详情中的 **managers** 比对：仅管理员名单内用户可执行发布。 |
| **skill_directories 配置** | 可选 `skill_directories: string[]`，额外扫描的 skill 根目录；相对路径相对于当前工作目录解析。 |
| **writeOmoConfig 增量合并** | 已存在配置文件时，新写入与已有配置 deepMerge，已有项优先，仅补充缺失。 |

---

## 二、在 OpenCode 终端/窗口中如何触发并验证

以下均在 **OpenCode 的聊天/终端界面** 中操作；Agent 会通过 **工具调用** 或 **斜杠命令** 执行能力。

### 1. 验证「平台 Agent 出现在列表并可切换」

- **操作**：在 OpenCode 中打开 Agent 选择器（如 /agents 或界面上的 Agent 下拉）。
- **预期**：列表中除内置 Agent（Sisyphus、Oracle 等）外，能看到 **fuyao:CodeHelper**、**fuyao:DocAgent**、**agentcenter:Reviewer** 等（名称以 mock 为准）；仅作为子 agent 的应用可能不在主列表，但可通过子 agent 或 @ 使用。
- **前提**：配置中 `platform_agent.enabled: true` 且 `platforms` 含 `fuyao` 或 `agentcenter`（install 后默认已包含）。

### 2. 验证「使用平台 Agent 对话」

- **操作**：在 Agent 下拉中选择 **fuyao:CodeHelper**（或任意平台 Agent），在输入框发一条普通消息，例如：「简单介绍一下你自己」。
- **预期**：该 Agent 按 mock 系统提示词回复；行为与内置 Agent 一致。
- **顺带验证**：主会话下首次用该 Agent 发消息后，`default_agent` 会被写回配置（下次启动会默认选中该 Agent，若需验证可重启 OpenCode 或查看配置文件）。

### 2.1 验证「平台下发的 skill/MCP 定义合并进 config」

- **说明**：平台应用可携带 `skill_definitions`、`mcp_definitions`；拉取时插件会将其合并进 OpenCode 的 `config.command`、`config.mcp`，无需本地已有同名 skill/MCP 即可被该 agent 使用。
- **操作**：启用平台 Agent（`platform_agent.enabled: true`、`platforms: ["fuyao"]`）并打开会话后，可在调试或单元测试中确认：config-handler 执行后，`config.command` 包含平台下发的 skill 定义（如 mock 中的 `platform-code-review`、`platform-doc-skill`），`config.mcp` 包含平台下发的 MCP 配置（如 mock 中的 `platform-helper-mcp`）。
- **终端/对话验证**：选择 **fuyao:CodeHelper** 后，询问「我可以用哪些 skill？」并让 Agent 调用 `list_available_skills`；列表中应包含平台下发的 skill（如 `platform-code-review`），说明已合并进 config 并被发现。

### 3. 验证「平台同步」/platform-sync

- **操作**：在输入框输入斜杠命令：
  ```text
  /platform-sync
  ```
  或带参数（由命令模板引导）：
  ```text
  /platform-sync fuyao --force-refresh
  ```
- **预期**：Agent 会调用 `platform_agent_sync` tool；返回「当前与平台一致」或「以下 Agent 有更新：…」或「已刷新到平台最新，共 N 个应用。」（当前为 Mock，具体文案以实现为准）。
- **说明**：若未配置该 platform，会返回「Platform "xxx" is not in configured platforms」。

### 4. 验证「平台发布」/platform-publish

- **操作**：先切换到平台 Agent（如 **fuyao:CodeHelper**），再输入：
  ```text
  /platform-publish
  ```
  或按命令提示传入 agent_name，例如在后续对话中让 Agent 使用 tool 时填 `agent_name: "fuyao:CodeHelper"`。
- **预期**：Agent 调用 `platform_agent_publish`，返回发布成功相关文案（当前 Mock 成功）；本地 version-cache 中该 name 的 version 会更新。
- **错误验证**：若传入非 platform:name（如 `sisyphus`），应返回要求使用 `fuyao:Name` 或 `agentcenter:Name` 的 Error 文案。
- **managers 校验**：若该应用配置了 **managers**（管理员名单），须在配置中设置 `platform_agent.publish_identity` 为当前用户身份（如 `alice@example.com`），且该身份在 managers 名单内才能发布；未配置 publish_identity 或身份不在名单内会返回明确错误（可本地修改，但不能发布）。

### 5. 验证「子 Agent 与 delegate_task」

- **操作**：选中一个配置了 subagents 的平台 Agent（或内置如 Sisyphus），在对话中询问：
  ```text
  你当前可以调用哪些子 agent？请用 list_available_subagents 看一下。
  ```
- **预期**：Agent 调用 `list_available_subagents`，返回列表中应包含其 subagents 白名单内的 agent。
- **操作**：再让当前 Agent 通过 delegate_task 调用某一子 agent 执行小任务（如「让 oracle 简单分析一下当前项目类型」）。
- **预期**：仅当被调 agent 在当前 agent 的 subagents 白名单内时，调用会成功；否则应被约束。

### 6. 验证「Skill 与 list_available_skills」

- **操作**：任意 Agent 对话中输入：
  ```text
  我可以用哪些 skill？请用 list_available_skills 列一下。
  ```
- **预期**：Agent 调用 `list_available_skills`，返回当前 agent 可用 skill 列表（受 skill_availability 与 agent.skills 配置影响）。

### 7. 验证「Skill 注入到 Agent」skill_inject_to_agent

- **操作**：在对话中让 Agent 使用 `skill_inject_to_agent` tool，例如：
  ```text
  请把 skill 市场里 id 为 market-code-review 的 skill 注入到 agent fuyao:CodeHelper，download_if_missing 为 true。
  ```
- **预期**：Agent 调用 tool；成功后返回「Injected skill "xxx" into agent "fuyao:CodeHelper"...」；配置文件中该 agent 的 `skills` 应包含对应 skill name。
- **说明**：当前市场为 Mock，id 以 mock-data 为准（如 market-code-review、market-doc-helper、market-test-gen）。

### 8. 验证「内置命令」init-deep / refactor / ralph-loop

- **操作**：在输入框输入：
  ```text
  /init-deep
  ```
  或
  ```text
  /refactor 将某文件的重复逻辑抽取成函数 --scope=file
  ```
  或
  ```text
  /ralph-loop 实现一个简单的 CLI 工具，能读入配置文件并打印
  ```
- **预期**：对应命令模板被加载，Agent 按模板中的步骤与工具（LSP、AST-grep、delegate 等）执行；/cancel-ralph 可终止 ralph-loop。

### 9. 验证「默认 Agent 持久化」

- **操作**：在主会话将 Agent 切换为 **fuyao:CodeHelper**，发送任意一条用户消息（如「hi」）。
- **预期**：发送后，配置文件中 `default_agent` 被写为 `fuyao:CodeHelper`（可打开 fuyao-opencode 配置文件查看）。下次启动 OpenCode 时，默认选中的应为该 Agent。

### 10. 验证「平台 Agent 有更新时的 Toast」

- **操作**：使用平台 Agent（如 fuyao:CodeHelper）在主会话发消息；若后端/缓存判断该 Agent 有版本更新（当前 Mock 可人为改缓存或适配器返回版本来模拟）。
- **预期**：可能收到 Toast「Agent 有更新…可执行 /platform-sync」；同一 session+agent 防抖只提示一次。

### 11. 验证「平台独有工具」platform_list_tools / platform_invoke_tool

- **操作**：选择平台 Agent（如 **fuyao:CodeHelper**），在对话中让 Agent 先列出该 agent 可用的平台工具，再执行其中一个，例如：
  ```text
  请用 platform_list_tools 看一下 fuyao:CodeHelper 有哪些平台工具可用。
  ```
  再根据返回的 toolId 与 tool_type 调用：
  ```text
  请用 platform_invoke_tool 调用 fuyao:CodeHelper 的 fuyao-code-gen，tool_type 填 toolSet，arguments 可以传空对象。
  ```
- **预期**：platform_list_tools 返回 mock 中的 toolSet/workflowToolSet 等摘要（如 fuyao-code-gen、fuyao-pipeline-validate）；platform_invoke_tool 返回 Mock 文案（含 toolId、toolType）。仅当**当前选中的 agent** 为该平台 agent 时才能成功调用 platform_invoke_tool（否则会提示当前 agent 与请求的 agent_name 不一致）。
- **说明**：非平台 Agent（如 sisyphus）无法使用 platform_list_tools、platform_invoke_tool（agent-tool-restrictions 已限制）。对接真实平台后，适配器 invokeTool 改为调平台执行接口即可。

---

## 三、配置与前置条件速查

| 验证项 | 建议配置 / 前置 |
|--------|------------------|
| 平台 Agent 列表可见 | `platform_agent: { enabled: true, platforms: ["fuyao"] }` 或含 agentcenter |
| 平台同步/发布 | 同上；sync 的 platform_type 需在 platforms 内；有 managers 的应用发布前需配置 publish_identity 且在名单内 |
| 默认 Agent 持久化 | 主会话 + 用户发消息即可；无需额外配置 |
| Skill 注入 | 配置目录可写；skill 市场当前 Mock，id 见 mock-data |
| 子 Agent / delegate | 使用的 Agent 在 config 中配置了 subagents（或平台拉取带 subagents） |
| 平台独有工具 | 当前 agent 为平台 Agent（如 fuyao:CodeHelper）；toolId、tool_type 以 platform_list_tools 返回为准；invokeTool 当前 Mock |

---

## 四、小结

- **平台对接**：通过 Agent 列表选平台 Agent、/platform-sync、/platform-publish 及对应 tool 调用验证。
- **平台独有工具**：选平台 Agent 后，用 platform_list_tools 查可用工具，再用 platform_invoke_tool 执行（当前 invokeTool 为 Mock）。
- **多 Agent 与 Skill**：通过 list_available_subagents、list_available_skills、delegate_task、skill_inject_to_agent 在对话中让 Agent 执行即可验证。
- **内置命令**：在输入框输入 /init-deep、/refactor、/ralph-loop、/platform-publish、/platform-sync 等触发。
- **默认 Agent**：切换 Agent 并在主会话发一条消息后，查看配置文件中 `default_agent` 是否写回。

当前平台列表/详情/发布、平台独有工具执行（invokeTool）与 Skill 市场列表/下载为 **Mock**；对接真实后端后替换适配器即可，上述触发方式仍适用。
