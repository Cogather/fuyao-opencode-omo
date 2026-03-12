# 基于 OMO 的 Agent 平台对接插件 · 设计文档

**文档与实现一致性**：本文档同时描述**设计目标**与**当前实现**。设计范围内能力**已全部实现**（含 getAgentDetail、platforms/types、Skill 市场列表/下载/注入、skill_inject_to_agent tool、persistAgentSkill）。其中**部分能力当前为 Mock**，需在对接真实后端时替换，详见 **第 11.5 节「Mock 能力与后期改造要点」**。已实现与 Mock 清单见 **第 11 节**；实现阶段划分见 **3.7**。**对原 OMO 的修改**：逐文件说明见 **3.2.0**，**配置项新增与默认值**见 **3.2.0.1**，**Prompt 相关修改**见 **3.2.0.2**。

---

## 1. 需求分析

### 1.1 项目背景

- **目的**：在 OpenCode 上使用 Agent 平台（如 fuyao、agentcenter）的 Agent 应用，支持动态拉取、在线调测、发布回平台。
- **约束**：不修改 OpenCode 源码，通过 OMO 插件扩展实现。
- **OMO（oh-my-opencode）**：运行在 OpenCode 上的插件框架，负责 Agent、Skill、MCP 的配置与行为；本插件在其上扩展，将平台 Agent 纳入 config 与运行时。

### 1.2 核心需求

| 序号 | 核心需求 | 说明 |
|------|----------|------|
| 1 | Agent 平台对接 | 在 OpenCode 中接入 Agent 平台，实现拉取、调测、发布与同步。 |
| 2 | 命令扩充 | 平台 Agent 支持绑定并调用 skill、MCP、subagents。 |
| 3 | 多 Agent 调用逻辑 | 平台 Agent 与 subagent 的调用关系、白名单与 delegate_task 约束。 |
| 4 | Agent 模型降级策略 | 平台不可用或拉取/发布失败时的降级与容错策略。 |

#### Agent 平台对接

- **动态拉取**：从平台拉取应用列表，转换为 OpenCode agent 配置并合并进 config；支持同时配置扶摇与 AgentCenter（`platforms: ["fuyao", "agentcenter"]`），按 platforms 遍历拉取；连接与鉴权由实现侧管理，对用户黑盒，用户只配置拉取类别（fuyao / agentcenter / 都要）。版本缓存按平台分 key。所以：平台 agent 列表只在运行时合并进 config.agent，不会回写到用户配置里的 agents。
- **手动覆盖**：支持在配置的 `agents` 中手动书写平台 agent 的 key，格式为 `platform:name`（冒号区分平台，name 与 mock/平台一致，如 `fuyao:CodeHelper`、`agentcenter:Reviewer`），用于覆盖运行时拉取结果、固定版本、配置 skills/mcps/subagents 等；合并时以「运行时平台条目为底、用户配置覆盖」，便于版本校验与本地调参。
- **在线调测**：平台 Agent 在 OpenCode 中与本地 Agent 同等使用（选 Agent、发消息、调用 skill/MCP）。
- **发布与同步**：提供 platform_agent_publish 将本地 Agent（含 skills、mcps、subagents）发布/更新到平台；提供 platform_agent_sync 拉取列表、与本地版本比对、force_refresh 更新缓存；版本校验通过 Toast 或同步返回文案提示更新。

#### 命令扩充

- 平台应用支持 **skill**、**MCP**、**subagents** 字段；拉取时写入 config.command、config.mcp 及 agent 的 subagents 配置，发布时一并上传。
- 涉及 config-bridge 的 platformAppToOpenCodeAgent / openCodeAgentToPlatformApp，以及 config-handler 对 config.agent/command/mcp 的合并。

#### 多 Agent 调用逻辑

- 可调列表由当前 agent 的 `subagents` 限定；delegate_task 仅允许该白名单内的 agent，实现 A→B→C 等多层调用。
- config-handler/config-bridge 为平台 agent 设置 delegate_task allow 并写入 subagents；executor 的 resolveSubagentExecution 按 parent 的 subagents 过滤 callableAgents；agent-tool-restrictions 对平台 agent 返回默认允许。

#### Agent 模型降级策略

- 平台拉取失败（网络超时、平台不可用）：config-handler 不崩溃，降级为不合并本次平台列表或保留上次缓存；sync 返回明确错误文案。
- 发布失败：返回平台错误信息，不写 version-cache。
- 鉴权失败或平台返回 401/403：实现侧记录日志并返回错误，不写脏缓存；不对用户暴露鉴权细节。
- version-cache 损坏或缺失：readVersionCache 返回 `{}`，不中断流程。

---

## 2. 系统架构

- **定位**：在 OMO 内增加「平台对接」能力，通过 **配置驱动 + 平台 API 封装** 将平台 Agent/Skill/MCP 纳入 OMO 的 config 与运行时。
- **分层**：
  - **配置层**：schema 中增加 `platform_agent`（enabled、platforms 数组：拉取类别）；连接与鉴权对用户黑盒，由实现或环境提供。✓ 已实现
  - **插件逻辑层**：config-handler 在合并 config 时拉取平台列表并合并、写 version-cache；index 注册 platform_agent_publish/platform_agent_sync、platform-publish/platform-sync command；message.updated 做版本校验与 Toast。✓ 已实现
  - **平台抽象层**：统一入口 `getPlatformAgentList` / `publishPlatformAgent`，按 platformType 调用 fuyao 或 agentcenter 的实现。✓ 已实现（publish 当前为 mock）
  - **平台实现层**：`platforms/fuyao.ts`、`platforms/agentcenter.ts` 实现 getAgentList、getAgentDetail、publishAgent（**当前均为 Mock**）；对接真实 HTTP 时替换为真实请求，见 11.5。
- **数据流**：平台列表 → version-cache（按平台）+ config.agent；用户发布 → publishPlatformAgent → 更新 version-cache；版本校验 → 读缓存 + 拉列表比对 → Toast 或 sync 返回文案。✓ 已实现（发布/同步为 mock 或真实由适配器决定）

---

## 3. 总体架构

以下 3.1 为核心组件与职责，**3.2 为涉及修改的 OMO 原始文件表**，**3.2.0 为对原 OMO 的逐文件修改说明**（含具体改动点与实现状态），3.2.1 起为配置项与平台扩展说明。

### 3.1 核心组件

下表为设计目标；**实现状态**见第 11 节（✓ 已实现、✗ 未实现）。

| 组件 | 职责 | 实现状态 |
|------|------|----------|
| **config-handler** | 在 config 合并末尾拉取平台列表，经 config-bridge 转为 OpenCode 配置并合并；写出版本到 version-cache。 | ✓ 已实现 |
| **platform-agent 模块** | 提供 types、api 统一入口、config-bridge（平台↔OpenCode 互转）、version-cache（读/写）、platforms（fuyao/agentcenter 实现）。 | ✓ 已实现（列表+发布 mock、version-cache、openCodeAgentToPlatformApp、publishPlatformAgent） |
| **platform_agent_publish / platform_agent_sync** | 发布到平台（带 skills/mcps/subagents）、同步与版本比对（含 force_refresh 写缓存）；以 tool 暴露，并可通过 command 调用。 | ✓ 已实现 |
| **event / hook** | 用户发消息且当前为平台 Agent 时触发版本校验，必要时 showToast 提示。 | ✓ 已实现（persistDefaultAgent + 平台版本校验与 Toast，防抖） |
| **delegate_task executor** | 解析 subagent 时若当前 agent 配置了 subagents，则仅允许该白名单内的 agent；与 agent-tool-restrictions 配合。 | ✓ 已实现 |

### 3.2 涉及修改的 OMO 原始文件与修改要点

下表为设计要点；**未实现项**（写 version-cache、注册 publish/sync tool、platform-publish/sync command、版本校验 Toast）见第 11.3 节。

| 原始文件 | 修改内容 | 实现状态 |
|----------|----------|----------|
| **`src/plugin-handlers/config-handler.ts`** | 若启用平台对接则遍历 platforms 调用 getPlatformAgentList，经 platformAppToOpenCodeAgent 转为配置并合并进 config.agent；写出版本到 version-cache。 | ✓ 已实现 |
| **`src/index.ts`** | 注册 platform_agent_publish、platform_agent_sync；注入 platform command；message.updated 做版本校验与 Toast。 | ✓ 已实现 |
| **`src/config/schema.ts`** | 增加 platform_agent（enabled、platforms）；agents 支持动态 key、subagents/mcps。 | ✓ 已实现 |
| **`src/features/builtin-commands/commands.ts`** | 增加 platform-publish、platform-sync。 | ✓ 已实现 |
| **`src/features/builtin-commands/types.ts`** | BuiltinCommandName 增加 platform-publish、platform-sync。 | ✓ 已实现 |
| **`src/tools/delegate-task/executor.ts`** | resolveSubagentExecution 中按 parent 的 subagents 过滤 callableAgents。 | ✓ 已实现 |
| **`src/shared/agent-tool-restrictions.ts`** | 平台 agent 无内置表项时返回默认（如 `{}`）。 | ✓ 已实现 |
| **`assets/fuyao-opencode.schema.json`** | schema 变更后重新生成。 | ✓ 存在 |

### 3.2.0 对原 OMO 的修改说明（逐文件）

本小节集中说明：为支持「平台 Agent 对接」及配套能力，**在原有 OMO 代码基础上做了哪些修改**。便于合入上游、冲突排查与代码评审。

- **逐文件修改**：下表为按文件列出的修改内容与实现状态。
- **配置项新增与默认值**：见 **3.2.0.1**（schema 新增字段、install 默认值一览）。
- **Prompt 相关修改**：见 **3.2.0.2**（平台 mock 提示词、config-bridge 中 prompt 映射、与 OMO 原有 prompt 逻辑的关系）。

| 原 OMO 路径 | 修改类型 | 具体修改内容 | 实现状态 |
|-------------|----------|--------------|----------|
| **`src/plugin-handlers/config-handler.ts`** | 修改 | ① 新增 `loadPlatformAgents(pluginConfig, directory)`：若 `platform_agent.enabled` 且 `platforms` 非空，则遍历 platforms 调用 `getPlatformAgentList`，经 `platformAppsToAgentRecord` 得到平台 agent 表；合并后调用 `writeVersionCache(platform, versionMap, directory)`。② 在合并 `config.agent` 时：先得到 `platformAgentRecord`，再与用户配置 `pluginConfig.agents` 按 key 合并（平台为底、用户覆盖）；对合并后的 agent 调用 `ensureSubagentsInOptions`。③ 合并完成后设置 `config.default_agent = pluginConfig.default_agent ?? ...`。 | ✓ 已实现 |
| **`src/config/schema.ts`** | 修改 | ① 新增 `PlatformAgentConfigSchema`（enabled、platforms: fuyao/agentcenter[]）并挂到 `OhMyOpenCodeConfigSchema.platform_agent`。② 新增 `default_agent: z.string().optional()`。③ `AgentOverrideConfigSchema` 增加 `subagents`、`mcps`。④ `AgentOverridesSchema` 改为 `.catchall(AgentOverrideConfigSchema.optional())`，支持动态 key（如 `fuyao:CodeHelper`）用于平台 agent 覆盖。 | ✓ 已实现 |
| **`src/index.ts`** | 修改 | 在 `event.message.updated` 中：当 sessionID 为主会话且 role 为 user 时，调用 `persistDefaultAgent(agent)`；若当前 agent 为平台 agent 则异步做版本校验，有更新时 `showToast`（防抖 Map<sessionID, Set<agentName>>）。注册 `platform_agent_publish`、`platform_agent_sync` tool；builtin-commands 含 platform-publish、platform-sync。 | ✓ 已实现 |
| **`src/features/builtin-commands/commands.ts`** | 修改 | 增加 `platform-publish`、`platform-sync` 定义（template 引导使用对应 tool）。 | ✓ 已实现 |
| **`src/features/builtin-commands/types.ts`** | 修改 | `BuiltinCommandName` 增加 `platform-publish`、`platform-sync`。 | ✓ 已实现 |
| **`src/tools/delegate-task/executor.ts`** | 修改 | 在 `resolveSubagentExecution` 中：当非 allowFullList 且存在 parentAgent 时，通过 `getSubagentsFromEntry(parentEntry)` 读取父 agent 的 `subagents`（含 `entry.options.subagents` 兼容）；若 parent 配置了 subagents，则 `callableAgents` 仅保留该白名单内的 agent，实现平台 agent 与 subagent 的多层调用约束。 | ✓ 已实现 |
| **`src/shared/agent-tool-restrictions.ts`** | 无需改 | 原有逻辑：未知 agent 名返回 `{}`（即无限制），平台 agent 名（如 `fuyao:CodeHelper`）不在内置表中，自然走默认允许，无需改代码。 | ✓ 已满足 |
| **`src/cli/model-fallback.ts`** | 修改 | 在 `generateModelConfig()` 的返回值（含无 provider 的 early return 分支）中增加 `platform_agent: { enabled: true, platforms: ["fuyao", "agentcenter"] }` 与 `default_agent: "sisyphus"`，保证 install 后默认配置包含平台对接与默认 agent。 | ✓ 已实现 |
| **`src/cli/config-manager.ts`** | 修改 | `writeOmoConfig` 在目标配置文件已存在时，使用 `deepMerge(newConfig, existing)`（existing 覆盖 newConfig），实现**增量写入**：仅补充缺失项，不覆盖用户已修改的配置。 | ✓ 已实现 |
| **`src/shared/persist-default-agent.ts`** | **新增** | 新文件：`persistDefaultAgent(agentName)` 将 `default_agent` 写回 fuyao-opencode 配置文件，供 `index.ts` 在 message.updated（主会话 + user）时调用，使下次启动沿用当前 agent。 | ✓ 已实现 |
| **`assets/fuyao-opencode.schema.json`** | 生成物 | schema 变更后需重新生成；项目内已存在该文件。 | ✓ 存在 |

**说明**：

- **仅新增、未改 OMO 原文件的**：`src/features/platform-agent/` 下全部为新增模块（types、api、config-bridge、platforms、index、mock-data），不修改 OMO 原有 feature 目录下的其他代码。
- **冲突与合入**：若与上游 OMO 同步，需重点核对 `config-handler.ts`（合并顺序与 loadPlatformAgents 插入点）、`schema.ts`（platform_agent、default_agent、agents catchall）、`delegate-task/executor.ts`（resolveSubagentExecution 中 subagents 过滤）、`index.ts`（message.updated 分支）、`model-fallback.ts`（返回值字段）、`config-manager.ts`（writeOmoConfig 的 deepMerge 语义）。

### 3.2.0.1 配置项新增与默认值

以下配置项为本插件在 OMO 配置上**新增或扩展**的字段；**定义位置**在 `src/config/schema.ts`，**install 时写入的默认值**在 `src/cli/model-fallback.ts` 的 `generateModelConfig()` 中。便于与上游 schema 对比、排查配置冲突。

| 配置项 | Schema 定义 | install 默认值（model-fallback） | 说明 |
|--------|-------------|----------------------------------|------|
| **`platform_agent`** | `PlatformAgentConfigSchema`：`enabled`、`platforms: ("fuyao"\|\"agentcenter")[]` | `{ enabled: true, platforms: ["fuyao", "agentcenter"] }` | 是否启用平台对接及拉取哪些平台；连接与鉴权不暴露。 |
| **`default_agent`** | `OhMyOpenCodeConfigSchema.default_agent: z.string().optional()` | `"sisyphus"` | 启动时默认选中的 agent；可由 `persistDefaultAgent` 在用户发消息后写回。 |
| **`skill_availability`** | `SkillAvailabilityConfigSchema`：`include_builtin_in_available`、`include_directory_in_available` | `{ include_builtin_in_available: true, include_directory_in_available: true }` | 控制各 agent 可见/可用的 skill 范围（内置 + 目录 vs 仅 agent.skills）。 |
| **`subagent_availability`** | `z.union([z.literal(true), SubagentAvailabilityConfigSchema])`：`include_builtin_in_available`、`include_directory_in_available` | `{ include_builtin_in_available: true, include_directory_in_available: true }` | 控制 subagent 可见与 delegate_task 可调范围；与 platform agent 白名单配合。 |
| **`agents` 动态 key** | `AgentOverridesSchema.catchall(AgentOverrideConfigSchema.optional())` | （不在此写入，由用户或平台拉取合并） | 支持 `fuyao:CodeHelper` 等平台 agent key，用于覆盖或扩展平台条目。 |
| **`AgentOverrideConfigSchema` 扩展** | 新增字段：`subagents: z.array(z.string()).optional()`、`mcps: z.array(z.string()).optional()`；原有 `prompt`、`prompt_append` 不变 | - | 平台 agent 在配置中可覆盖 subagents、mcps；prompt/prompt_append 仍用于任意 agent 覆盖。 |

**说明**：`skill_availability`、`subagent_availability` 的默认值在 `generateModelConfig()` 两处 return 中均存在（无 provider 的 early return 与正常 return），与 `platform_agent`、`default_agent` 一致。

### 3.2.0.2 Prompt 相关修改

以下为与 **prompt / 系统提示词** 相关的修改与约定，便于与上游或平台侧对齐、排查行为差异。

| 位置 | 类型 | 内容说明 | 实现状态 |
|------|------|----------|----------|
| **`src/features/platform-agent/mock-data.ts`** | 新增 | **扶摇 Mock 系统提示词**：`FUYAO_MOCK_SYSTEM_PROMPT = "You are a Fuyao platform agent. Follow user instructions and use available tools. Stay concise and accurate."`；**AgentCenter Mock 系统提示词**：`AGENTCENTER_MOCK_SYSTEM_PROMPT = "You are an AgentCenter platform agent. Assist the user with their requests using the provided tools and context."`。各 mock agent 的 `prompt` 为「上述基础句 + 换行 + Focus: xxx」，例如 `FUYAO_MOCK_SYSTEM_PROMPT + "\nFocus: code generation and refactoring."`。真实接入后由平台/API 返回的 `prompt` 替代。 | ✓ 已实现（阶段一 mock） |
| **`src/features/platform-agent/config-bridge.ts`** | 新增 | `platformAppToOpenCodeAgent` 将平台应用的 `app.prompt` 原样写入 OpenCode agent 条目的 `entry.prompt`，即**平台侧系统提示词直接作为该 agent 的 prompt**，无二次拼接或覆盖（用户可在 `agents["fuyao:CodeHelper"].prompt` 中覆盖）。 | ✓ 已实现 |
| **`src/config/schema.ts`** | 未改 prompt 定义 | `AgentOverrideConfigSchema` 中已有 `prompt`、`prompt_append`；平台 agent 覆盖时同样生效，用于在配置中改写或追加 prompt。 | ✓ 沿用 |
| **`src/plugin-handlers/config-handler.ts`** | 未改 prompt 逻辑 | 合并 agent 时不对 platform 拉取得到的 `prompt` 做统一改写；仅在与用户配置合并时，若用户写了 `agents["fuyao:CodeHelper"].prompt"` 或 `prompt_append`，按既有 OMO 逻辑覆盖或追加。 | ✓ 沿用 |
| **delegate_task / 其他 OMO prompt** | 未改 | Sisyphus、Atlas、Hephaestus 等内置 agent 的 prompt 构建（`buildDynamicSisyphusPrompt`、`buildDynamicOrchestratorPrompt`、`buildHephaestusPrompt`）、delegate_task 的 `buildSystemContent` 等**未因平台对接而修改**；平台 agent 作为 subagent 被调用时，其 prompt 仍来自 config.agent 中该条目的 `prompt`（即平台或 mock 提供）。 | ✓ 无变更 |

**约定**：平台 Agent 的**系统提示词来源**为「平台列表/详情 API 返回的 `prompt` 字段」或阶段一 mock 的 `mock-data.ts`；接入真实 API 后需保证返回结构与 `PlatformAgentApp.prompt` 一致，避免 config-bridge 或 config-handler 再解析富文本或模板。

### 3.2.1 新增配置项如何实现

本小节说明：在插件中**新增一个配置项**（例如新增一个与 `platform_agent` 同级的配置段）需要改哪些地方。**并非**每加一个配置项都要复制 platform-agent 的整包结构（index/types/api 等）；只有「在 platform-agent 里新增一个平台」时才动 platform-agent 内部（见 3.2.2）。

#### 配置项 vs 平台

| 操作 | 是否按 platform-agent 整包结构来？ | 主要改哪里 |
|------|-----------------------------------|------------|
| **新增一个配置项**（如 `xxx_agent: { enabled, ... }`） | 不需要 | 仅 **config/schema.ts**（及按需 model-fallback、使用该配置的代码）。 |
| **在 platform-agent 里新增一个平台**（如再对接一个第三方平台） | 部分需要 | **types.ts** 扩展 `PlatformType`；**platforms/** 下新增适配器并在 **platforms/index.ts** 注册；可选 mock-data。 |

#### 新增配置项的实现步骤

1. **在 `src/config/schema.ts` 中定义并挂载**
   - 用 zod 定义该配置段的 schema（如 `XxxConfigSchema = z.object({ enabled: z.boolean().optional(), ... })`）。
   - 在主配置 schema（`OhMyOpenCodeConfigSchema`）中增加字段，例如：`xxx_agent: XxxConfigSchema.optional()`。
   - 若需要对外类型，可 `export type XxxConfig = z.infer<typeof XxxConfigSchema>`。

2. **（可选）安装时写入默认值**
   - 仅当希望**执行 install 时生成的默认 omo 配置**里就包含该字段时，才需要改 **`src/cli/model-fallback.ts`**。
   - 在 `generateModelConfig()` 的 return 对象中增加该字段，例如：`xxx_agent: { enabled: true }`。
   - 仅由用户手写或由其他逻辑后续写入的配置，**不需要**在 model-fallback 的返回值里出现。

3. **在业务逻辑中使用**
   - 在 config-handler、index、或其它需要读取配置的地方，通过 `pluginConfig.xxx_agent` 使用（类型来自 schema 的 infer）。

4. **（可选）同步 JSON Schema 资产**
   - 若项目会生成 `assets/fuyao-opencode.schema.json` 供编辑器/校验使用，schema 变更后需重新生成该文件。

#### 速查表

| 需求 | 修改位置 |
|------|----------|
| 新增或修改某配置项的类型、校验、是否可选 | 仅 **schema.ts**：定义/修改对应 schema，并在主 config schema 中挂载该字段。 |
| 希望「安装时生成的默认 omo 配置」里就包含该字段的默认值 | 在 **model-fallback.ts** 的 `generateModelConfig()` 的 return 对象中增加该字段。 |
| 配置要在运行时被使用 | 在 config-handler、index 等处通过 `pluginConfig.xxx_agent` 读取并实现逻辑。 |

### 3.2.2 在 platform-agent 中新增一个平台

若要在「平台 Agent 对接」中**新增一个平台**（如第三方 Agent 平台），需在 `features/platform-agent` 内做以下修改（**不需要**为每个平台单独再建一套 index/api/config-bridge）：

| 修改位置 | 操作 |
|----------|------|
| **types.ts** | 在 `PlatformType` 中增加新字面量（如 `"thirdparty"`）。 |
| **platforms/xxx.ts** | 新建适配器文件，实现 `IPlatformAdapter`（至少实现 `getAgentList`），返回 `PlatformAgentApp[]`。 |
| **platforms/index.ts** | import 新适配器，并在 `adapters` 中注册（如 `adapters.thirdparty = thirdpartyAdapter`）。 |
| **mock-data.ts**（可选） | 若阶段内使用 mock，可增加 `MOCK_XXX_AGENTS` 并在新适配器中引用。 |
| **config/schema.ts** | 若新平台需出现在用户可配置的 `platform_agent.platforms` 列表中，需在 schema 的 `platforms` 枚举中增加新值（如 `z.enum(["fuyao", "agentcenter", "thirdparty"])`）。 |

`api.ts`、`config-bridge.ts` 已按 `platformType` 通用处理，新增平台一般无需修改；仅当新平台有特殊字段或映射规则时再改 config-bridge。

### 3.3 新代码结构（目录与新增文件）

> **路径说明**：platform-agent 模块实际位于 **`src/features/platform-agent/`**（非 `src/platform-agent/`）。以下为设计目标结构；与当前实现差异见 **第 11 节「设计文档与代码一致性检查」**。

```
src/
  features/
    platform-agent/         # 实际路径：src/features/platform-agent/
      constants.ts          # 缓存文件名等常量 ✓（API路径？）
      types.ts              # PlatformAgentApp、请求/响应类型、PlatformType ✓
      platforms/
        types.ts            # 当前无独立 types，复用上级 types ✓
        fuyao.ts            # getAgentList（阶段一 mock）；getAgentDetail/publishAgent 未实现
        agentcenter.ts      # 同上
        index.ts            # 按 platformType 返回对应实现 ✓
      api.ts                # getPlatformAgentList ✓；publishPlatformAgent 未实现
      config-bridge.ts      # platformAppToOpenCodeAgent, platformAppsToAgentRecord, openCodeAgentToPlatformApp ✓
      version-cache.ts      # readVersionCache / writeVersionCache / getCacheFilePath ✓
      index.ts              # ✓
  tools/
    platform-agent-publish/   # ✓ createPlatformAgentPublishTool
    platform-agent-sync/      # ✓ createPlatformAgentSyncTool
  hooks/
    (版本校验在 index 的 message.updated 中实现，无需独立 hook)
  config/
    schema.ts              # platform_agent 段 ✓
```

**新增文件清单**：`features/platform-agent/` 下 types、platforms/*、api、config-bridge、index、constants、version-cache 已实现；`tools/platform-agent-publish`、`tools/platform-agent-sync` 已实现；builtin-commands 已含 platform-publish、platform-sync。详见第 11 节。

### 3.4 平台区分（fuyao / agentcenter）

- **配置（用户侧）**：用户只配置**拉取类别**。`platform_agent.platforms: ("fuyao" | "agentcenter")[]` 表示要拉取并展示的平台，例如 `["fuyao"]`、`["agentcenter"]` 或 `["fuyao", "agentcenter"]`。连接与鉴权对用户黑盒，由实现或环境提供，不做 token 等校验配置暴露。
- **OpenCode 感知方式**：插件通过 **config hook** 参与 OpenCode 的 config 合并。在 config-handler 中拉取平台列表后，将平台 agent **统一并入 `config.agent`**；OpenCode 使用的就是这份合并后的 config，agent 列表即包含内置 agent 与平台 agent，无需 OpenCode 侧任何额外感知逻辑。
- **拉取**：config-handler 遍历 `platforms`，对每项调 `getPlatformAgentList(platformType)`（连接由实现侧解析），将各平台返回的列表合并进 `config.agent`；平台 agent 名带前缀（如 `fuyao:AppName`、`agentcenter:AppName`），避免跨平台重名且便于发布/同步时识别所属平台。
- **API**：`platforms/fuyao.ts`、`platforms/agentcenter.ts` 实现同一接口；`api.ts` 按 platformType 调用。
- **版本缓存**：按平台分 key（如 `.platform-agent-cache-fuyao.json`），互不覆盖。
- **发布/同步**：tool 与 command 需指定 platformType（或从当前 agent 名前缀解析），保证发布/比对针对同一平台。

### 3.5 平台 Agent 的 skill / MCP / subagent

- **数据模型**：平台应用含 skills、mcps、subagents（均为字符串数组）；对应 config.command、config.mcp、以及 delegate_task 可调列表。
- **拉取**：`platformAppToOpenCodeAgent` 将上述字段写入 agent 配置并合并进 config.agent/command/mcp。
- **发布**：`openCodeAgentToPlatformApp` 从 config 收集该 agent 的 skills/mcps/subagents，组进发布 body；publish tool 调用 `publishPlatformAgent`。
- **Skill 来源扩展**：skills 除平台拉取与用户手配外，可来自 **Skill 市场**——从市场获取可选 skill 列表、选择后注入到指定 agent，并将 skill 下载到约定位置供 OMO 读取。详见 **3.10 Skill 市场对接**。
- **涉及文件**：types、config-bridge、config-handler、platform-agent-publish、platforms/*。

### 3.6 Subagent 多层调用

- **原则**：permission 允许 delegate_task；可调列表由当前 agent 的 `subagents` 限定；多层即 A→B→C 时 A 的 subagents 含 B、B 的 subagents 含 C。
- **实现**：config-handler/config-bridge 合并时为平台 agent 设 delegate_task allow 并写入 subagents；executor 的 `resolveSubagentExecution` 拿到 parent 的 subagents 后过滤 callableAgents；agent-tool-restrictions 对平台 agent 做兼容。
- **涉及文件**：config-handler、config-bridge、delegate-task/executor、agent-tool-restrictions。

### 3.7 实现阶段建议

| 阶段 | 内容 | 说明 |
|------|------|------|
| 1 | 平台配置项（schema）+ fuyao/agentcenter 适配器 + 统一 api 入口 + config-handler 合并 | **阶段一使用 Mock**：不请求真实平台 API；适配器返回 mock 数据（见 3.8）。 |
| 2 | config-handler 拉取、config-bridge 转换、合并、写 version-cache | 可切真实 API + version-cache |
| 3 | 发布/同步 command + tool（platformType、force_refresh） | - |
| 4 | 版本检查与提示（event/hook Toast + sync 返回文案） | - |
| 5 | delegate_task subagents 白名单 + agent-tool-restrictions 兼容 | - |

### 3.8 开发：阶段一 平台 Agent 列表拉取

**目标**：在 OpenCode 的 Agent 列表中拿到「当前用户有权限」的扶摇与 AgentCenter 上的全部 Agent，在配置合并时注入 `config.agent`。本阶段仅做拉取列表 → 转成 agent 配置 → 合并；发布、同步、版本缓存、subagents 等放在后续阶段。

**阶段一使用 Mock**：本阶段**不请求**扶摇/AgentCenter 真实 API。适配器（`platforms/fuyao.ts`、`platforms/agentcenter.ts`）统一返回 **mock 数据**；mock 数据与 SDK 系统提示词（system prompt）定义在 `features/platform-agent/mock-data.ts`，内含扶摇与 AgentCenter 的模拟系统提示词及若干示例 Agent（如 CodeHelper、DocAgent、Reviewer、QAAgent）。后续阶段再将适配器替换为真实 HTTP 调用。

**平台区分**：用户只配置 **`platform_agent.platforms`**，表示拉取类别：`["fuyao"]`、`["agentcenter"]` 或 `["fuyao", "agentcenter"]`。连接与鉴权对用户黑盒，由实现侧提供，不在配置中暴露。实现上每个平台一个适配器，统一接口 `IPlatformAdapter.getAgentList(options)`；`getPlatformAgentList(platformType)` 按 platformType 取适配器，连接在实现内解析。

**同时配置两平台时**：拉取时遍历 `platforms`，对每项调 `getPlatformAgentList(platformType)`，将各平台返回的列表合并进 config.agent；agent 名带平台前缀（`fuyao:AppName`、`agentcenter:AppName`），避免两平台应用重名且便于发布/同步时识别所属平台。

**「有权限」**：由平台侧与实现侧鉴权保证，列表只含当前用户可用的应用；插件不做额外 token 校验暴露。若某平台返回全量且带权限字段，可在 adapter 内过滤。

**Schema（platform_agent 段，用户可见）**：`enabled`、**`platforms: ["fuyao"] | ["agentcenter"] | ["fuyao", "agentcenter"]`**（拉取类别）。不暴露 baseUrl/token 等连接与鉴权字段。

**接口与目录（阶段一最小集）**：
- **types**：`PlatformType`、`PlatformAgentApp`（id、name、version、prompt、model、permission、skills、mcps、subagents 等）、`IPlatformAdapter`（`getAgentList(options)`）。
- **mock-data.ts**：阶段一 mock 数据及 SDK 系统提示词（扶摇/AgentCenter 各一套模拟 prompt，若干示例 Agent）。
- **platforms/fuyao.ts、agentcenter.ts**：实现 `IPlatformAdapter`；阶段一返回 mock 列表，后续替换为真实列表 API 并映射为 `PlatformAgentApp[]`。
- **platforms/index.ts**：`getPlatformAdapter(platformType)`。
- **api.ts**：`getPlatformAgentList(platformType)`（委托适配器，阶段一为 mock）。
- **config-bridge.ts**：`platformAppToOpenCodeAgent(app, platform)`、`platformAppsToAgentRecord(apps, platform)`，将 `PlatformAgentApp` 转为 OpenCode agent 配置；平台 agent 键带前缀（如 `fuyao:AppName`）避免与内置 agent 重名。

**config-handler 接入**：在已有 agent 合并完成、写 `config.agent` 之前插入：读 `pluginConfig.platform_agent`，若 enabled 且 `platforms` 非空，则遍历 `platforms`，对每项调 `getPlatformAgentList(platform)`（连接由实现内解析）→ `platformAppToOpenCodeAgent(app, platform)`（带平台前缀）→ 将结果合并进 agent 对象；某一平台拉取失败时 catch、打日志、该平台不合并，不阻塞其余平台及 config 加载。

**开发顺序**：(1) schema 增加 platform_agent；(2) platform-agent/types.ts；(3) platforms/fuyao.ts、agentcenter.ts（需扶摇/AgentCenter 列表 API 路径与响应格式）；(4) platforms/index.ts、api.ts；(5) config-bridge 的 platformAppToOpenCodeAgent；(6) config-handler 接入。扶摇/AgentCenter 的列表接口路径、Header、分页及响应字段需对接方确认，adapter 内做映射或分页循环。

**install 默认写入 platform_agent**：执行 install（如 `bun node_modules/fuyao-opencode/dist/cli/index.js install` 或 `bunx fuyao-opencode install`）时，写入的默认 fuyao-opencode 配置中应包含 **`platform_agent: { enabled: true, platforms: ["fuyao", "agentcenter"] }`**，即默认把扶摇和 AgentCenter 都勾上；用户若只需单一平台，可在配置中改为 `["fuyao"]` 或 `["agentcenter"]`。实现上在 writeOmoConfig / generateOmoConfig 或 install 流程里合并该默认段即可。

### 3.9 已实现行为补充（实现与约定）

以下为当前代码已落地的约定与行为，便于与设计对照与后续维护。

#### 3.9.1 平台 Agent 的 config key 与 entry.name

- **config key**：`config.agent` 中平台 agent 的 key 为 **`platform:name`**（如 `fuyao:CodeHelper`、`agentcenter:Reviewer`），与 mock-data 的 `name` 一致，冒号区分平台。
- **entry.name**：转成 OpenCode agent 条目时，**`entry.name` 必须与 config key 相同**（即 `"fuyao:CodeHelper"`），否则 OpenCode 按 `agent.name` 查找会得到 undefined。`description` 仍用人类可读的 app 名或描述。
- **实现位置**：`features/platform-agent/config-bridge.ts` 的 `platformAppToOpenCodeAgent`、`platformAppsToAgentRecord`。

#### 3.9.2 agents 手动配置与合并顺序

- **Schema**：`agents` 使用 **`AgentOverridesSchema.catchall(AgentOverrideConfigSchema.optional())`**，支持除内置 agent 外的**动态 key**（如 `fuyao:CodeHelper`）；`AgentOverrideConfigSchema` 支持 `subagents`、`mcps` 等，便于对平台 agent 做覆盖。
- **用户覆盖来源**：config-handler 中用户侧 agent 覆盖来自 **`pluginConfig.agents`**（配置文件），不再用传入 config 的 agent。
- **合并顺序**：先得到运行时的 `platformAgentRecord`，再与 `userAgentOverrides` 按 key 合并：若 key 在 platform 中存在，则 **`{ ...platformEntry, ...userOverride }`**（用户覆盖运行时）；仅出现在用户配置的 key 则直接使用。最终 `config.agent` 中手动配置可覆盖运行时写入，用于固定版本、配置 skills/mcps/subagents。
- **实现位置**：`config/schema.ts`（agents catchall、subagents/mcps）；`plugin-handlers/config-handler.ts`（loadPlatformAgents、mergedPlatformAndUser 逻辑）。

#### 3.9.3 install 增量写入配置

- **行为**：执行 install 写入 fuyao-opencode 配置时，若目标文件已存在，采用 **增量合并**：以**已有配置为优先**，仅对缺失的 key 用本次生成的默认值补充，不覆盖用户已改项。
- **实现**：`writeOmoConfig` 中合并顺序为 **`deepMerge(newConfig, existing)`**（newConfig 为底，existing 覆盖），保证已有配置保留。
- **实现位置**：`cli/config-manager.ts` 的 `writeOmoConfig`。

#### 3.9.4 default_agent 配置与持久化

- **配置项**：Schema 中增加 **`default_agent: z.string().optional()`**，表示启动时使用的默认 agent（如 `"sisyphus"`、`"fuyao:CodeHelper"`）。
- **读取与设置**：config-handler 在合并完 `config.agent` 后，设置 **`config.default_agent = pluginConfig.default_agent ?? (启用了 sisyphus 时 "sisyphus"，否则不强制)**，供 OpenCode 使用。
- **install 默认**：`generateModelConfig` 的返回值（含无 provider 的 early return）中均包含 **`default_agent: "sisyphus"`**，新装或空配置会写入该默认。
- **持久化「当前使用的 agent」**：OpenCode 不会在用户切换 agent 时自动写回配置。OMO 在 **`message.updated`** 事件中，当 **主会话**（`sessionID === getMainSessionID()`）且 **role === "user"** 时，将当前 `agent` 写入配置文件的 **`default_agent`**（`persistDefaultAgent(agent)`），下次启动即使用该默认。仅在「主会话用户发消息」时持久化，纯切换下拉框未发消息则不会写回（除非 OpenCode 后续提供切换事件）。
- **实现位置**：`config/schema.ts`（default_agent）；`cli/model-fallback.ts`（generateModelConfig 两处 return）；`plugin-handlers/config-handler.ts`（default_agent 赋值）；`shared/persist-default-agent.ts`（persistDefaultAgent）；`index.ts`（event.message.updated 中调用 persistDefaultAgent）。

### 3.10 Skill 市场对接（设计）

在完成平台 Agent 列表对接后，需要进一步对接 **Skill 市场**：获取可选的 skill 列表、支持用户选择某个 skill 注入到指定 agent，并将该 skill **下载到约定位置**，保证 OMO/OpenCode 能读取使用。

#### 3.10.1 目标与范围

| 目标 | 说明 |
|------|------|
| 获取可选的 skill 列表 | 从 Skill 市场（与平台同源或独立）拉取当前用户可用的 skill 列表，供 UI 展示与选择。 |
| 选择 skill 注入到指定 agent | 用户选择「某 skill → 注入到某 agent」后，将该 skill 的**名称**加入该 agent 的 `skills` 配置（与现有 agent.skills 一致）；若为平台 agent，发布时一并上传。 |
| 下载到约定位置并可读 | 用户选择使用某市场 skill 时，将 skill 包下载并解压到 **约定目录**，该目录需被 OMO 的 skill 发现链路扫描到，从而进入 `config.command` 并被 agent 引用。 |

#### 3.10.2 与现有 Skill 机制的衔接

- **OMO 侧 skill 发现**：`opencode-skill-loader` 从以下目录扫描 skill（每个子目录下的 `SKILL.md` 或 `{name}.md` 视为一个 skill）：
  - OpenCode 全局：`getOpenCodeConfigDir()/skills`（`discoverOpencodeGlobalSkills`）
  - 项目：`.opencode/skills`、`.claude/skills`
  - 用户：`getClaudeConfigDir()/skills`
- **config 合并**：`config-handler` 将上述发现的 skill 与 builtin commands 等一起合并进 `config.command`；agent 的 `skills` 数组为 **skill 名称列表**，运行时通过 name 在 `config.command` 中解析。
- **结论**：市场下载的 skill 必须落在上述某一发现路径内，且目录内包含符合约定的 `SKILL.md`（或等价 markdown + frontmatter），才能被加载并供 agent 使用。

#### 3.10.3 约定存储位置（推荐）

建议将「从市场下载的 skill」统一放在 **OpenCode 全局配置目录下的固定子目录**，与现有 opencode global skills 共用发现逻辑，且与用户/项目本地 skill 隔离，便于管理与升级：

- **下载根目录**：`<OpenCode 配置目录>/skills/market`
  - 即 `join(getOpenCodeConfigDir(), "skills", "market")`。
- **单个 skill 的目录**：`<下载根目录>/<skillId>/`
  - 每个市场 skill 解压或展开到独立子目录，目录内至少包含 `SKILL.md`（及可选 `mcp.json` 等）。
  - `<skillId>` 建议使用市场侧唯一 id（或 `platform-<platform>-<id>`），避免重名；skill 的**展示名/命令名**由 `SKILL.md` 的 frontmatter `name` 决定，与 agent 的 `skills: [name]` 一致。

**与现有 loader 的兼容**：当前 `loadSkillsFromDir` 只扫描**一层**子目录（每个 entry 为目录时在其内找 `SKILL.md`），**不会**递归进入 `skills/market/xxx`。因此需二选一：

- **方案 A（推荐）**：扩展 opencode-skill-loader，在 `discoverOpencodeGlobalSkills` 中**额外**扫描 `configDir/skills/market` 下的每个子目录（每个子目录一个 market skill），与现有 `configDir/skills` 下的一层目录并列汇总；或统一改为「扫描 configDir/skills 时递归一层」，即 `configDir/skills` 与 `configDir/skills/market/*` 均参与。
- **方案 B**：不建 `market` 子目录，直接将每个市场 skill 解压到 `configDir/skills/<skillName>/`（与用户可见的「全局 skill」混在一起）；实现简单，但不易区分来源、不便做「仅更新市场 skill」的维护。

设计采用 **方案 A**：约定下载根目录为 `configDir/skills/market`，每个 skill 为 `market/<skillId>/`，并在 opencode-skill-loader 中增加对 `configDir/skills/market` 的扫描（或对 `configDir/skills` 做一层递归），使该目录下每个子目录被识别为一个 skill。

#### 3.10.4 数据模型与 API 抽象

- **Skill 市场条目**（建议类型，如 `SkillMarketItem`）：
  - `id`：市场唯一标识，用于下载与目录命名。
  - `name`：技能名称，与 `SKILL.md` 的 frontmatter `name` 一致，供 agent 的 `skills: [name]` 引用。
  - `version`：可选，用于版本比对与更新。
  - `description`：可选，列表展示用。
  - `downloadUrl` 或 `packageUrl`：下载地址（或平台返回的包/归档地址）。
  - 其他：如 `platform`（来源平台）、`license`、`compatibility` 等按需扩展。

- **平台抽象**（与 platform-agent 对齐）：
  - 若 Skill 市场与 Agent 平台同源（如扶摇/AgentCenter 均提供 agent 列表 + skill 市场），可在同一 `platforms/fuyao.ts`、`platforms/agentcenter.ts` 中增加：
    - `getSkillMarketList(options?)` → `Promise<SkillMarketItem[]>`
    - `getSkillMarketDetail(id)` → `Promise<SkillMarketItem | null>`
    - `downloadSkill(id, targetDir)` → `Promise<string>`（返回解压后的目录路径，即约定位置下的 `<skillId>`）。
  - 若 Skill 市场为独立服务，可单独增加 `skill-market` 模块或新 adapter，对外统一 `getSkillMarketList`、`downloadSkill`；列表与下载接口由实现侧对接具体 API。

- **统一入口**（如 `features/skill-market/api.ts` 或放在 `platform-agent` 内）：
  - `getSkillMarketList(platformType?)`：按平台或全局拉取可选的 skill 列表。
  - `downloadSkillToMarket(skillId, platformType?)`：下载指定 skill 到约定位置（`configDir/skills/market/<skillId>/`），解压后返回本地路径；若已存在可先比较 version 再决定是否覆盖。

#### 3.10.5 注入到指定 Agent 的流程

1. **用户侧**：在 UI 中选择「从市场添加 skill」→ 选择市场中的某 skill → 选择要注入的 agent（可为平台 agent 或本地 agent）。
2. **插件侧**：
   - 若该 skill 尚未下载：调用 `downloadSkillToMarket(skillId)`，将 skill 下载到约定位置；确保 opencode-skill-loader 能发现（见 3.10.3）。
   - 将该 skill 的 **name**（与 `SKILL.md` 中 name 一致）加入**指定 agent** 的 `skills` 配置。实现上即写回用户配置的 `agents`：若为平台 agent（如 `fuyao:CodeHelper`），在 `pluginConfig.agents["fuyao:CodeHelper"].skills` 中追加该 name；若为内置/本地 agent，在对应 `agents[agentKey].skills` 中追加。
3. **持久化**：对 `agents` 的修改需写回配置文件（与现有 default_agent、agents 覆盖一致），以便下次启动生效。
4. **发布**：当 agent 为平台 agent 且用户执行发布时，`openCodeAgentToPlatformApp` 已包含 `skills` 数组，市场 skill 的 name 会一并发布到平台。

#### 3.10.6 实现要点小结

| 项 | 说明 |
|----|------|
| 目录约定 | 市场 skill 下载根目录：`getOpenCodeConfigDir()/skills/market`；每个 skill：`market/<skillId>/`，内含 `SKILL.md`。 |
| 发现链路 | 扩展 opencode-skill-loader，使 `configDir/skills/market` 下每个子目录参与 skill 发现（或对 `configDir/skills` 做一层递归），与现有 command 合并逻辑无冲突。 |
| 列表与下载 | 平台适配器或独立 skill-market 模块提供 getSkillMarketList、downloadSkill；下载后解压到约定目录，保证 name 与 frontmatter 一致。 |
| 注入 | 在 `pluginConfig.agents[agentKey].skills` 中追加 skill name，并写回配置文件。 |
| 命令分工 | **/skills**：仅展示目录/原有 skill 列表，不合并市场列表。**/agent-add-skill**：对接市场，动态拉取目录+市场列表、支持 query 动态检索，用户选择后加入当前 agent。 |
| 版本与更新 | 可选：对市场 skill 做 version 缓存（类似 platform-agent version-cache），支持「检查更新」与增量下载。 |

#### 3.10.7 涉及文件与扩展点（建议）

| 位置 | 修改或新增 |
|------|------------|
| **features/skill-market/**（或 platform-agent 内扩展） | types（SkillMarketItem）、api（getSkillMarketList、downloadSkillToMarket）、platforms 或 adapter（列表/下载接口）。 |
| **features/opencode-skill-loader** | 在 discoverOpencodeGlobalSkills 或 loadSkillsFromDir 中增加对 `configDir/skills/market` 的扫描（或递归一层），使市场 skill 进入 config.command。 |
| **shared** | 可选：getMarketSkillsDir() 返回约定根目录，供下载与 loader 共用。 |
| **config-handler** | 无需改合并顺序；agent 的 skills 已来自 pluginConfig.agents 与平台合并结果，只需保证「注入」时写回 agents 配置。 |
| **Tools/Commands** | 可选：提供 `skill_market_list`、`skill_market_download`、`skill_inject_to_agent` 等 tool/command，供 UI 或命令行触发列表、下载、注入。 |

#### 3.10.8 阶段建议

| 阶段 | 内容 |
|------|------|
| 1 | 定义 SkillMarketItem、约定存储位置、扩展 opencode-skill-loader 扫描 market 目录；适配器 mock 列表与下载（返回本地占位或测试包）。 |
| 2 | 对接真实 Skill 市场列表/详情/下载 API；实现 downloadSkillToMarket，并实现「注入到 agent」的配置写回。 |
| 3 | 可选：version 缓存与更新提示；tool/command 暴露与 UI 集成。 |

**实现状态**：3.10 已实现（features/skill-market、getMarketSkillsDir、opencode-skill-loader 扫描 market、persistAgentSkill、skill_inject_to_agent tool）；列表与下载当前为 **Mock**，见 **11.5**。

---

## 4. UML 4+1 视图

### 4.1 逻辑视图

- **包/模块**：config（schema）、plugin-handlers（config-handler）、platform-agent（api、config-bridge、version-cache、platforms）、tools（platform-agent-publish、platform-agent-sync）、hooks（platform-agent-version-check 可选）、shared（agent-tool-restrictions）、delegate-task（executor）。
- **依赖**：config-handler 依赖 platform-agent（api、config-bridge、version-cache）；index 依赖 config-handler、tools、hooks；publish/sync tools 依赖 platform-agent api 与 version-cache；executor 依赖 config/context 获取当前 agent 的 subagents。

### 4.2 开发视图

- **目录结构**：见 3.3；OMO 原有 plugin-handlers、config、features、tools、shared 等在现有基础上做点状修改。
- **接口边界**：platform-agent 对外暴露 getPlatformAgentList、**getPlatformAgentDetail**、publishPlatformAgent、readVersionCache、writeVersionCache、platformAppToOpenCodeAgent、openCodeAgentToPlatformApp；各 platform 实现 getAgentList、getAgentDetail、publishAgent（当前均为 Mock，见 11.5）。

### 4.3 进程视图

- **事件流**：用户发消息 → event message.updated → 取 agent/role → 若为平台 agent 则异步拉列表、读缓存、比对版本 → 若有更新则 showToast。
- **同步流程**：用户执行 platform_agent_sync → 拉列表、读缓存、比对 → 若 force_refresh 则写缓存并返回「已刷新」；否则返回有更新列表或「与平台一致」。
- **发布流程**：用户执行 platform_agent_publish → 从 config 取当前/指定 agent → openCodeAgentToPlatformApp → publishPlatformAgent → 成功后写 version-cache。
- **配置加载**：OMO 加载 config → config-handler 合并 builtin/user/project/plugin 后 → 若启用平台则 getPlatformAgentList → 合并 + writeVersionCache。

### 4.4 物理视图

- **进程**：OMO 插件与 OpenCode 同进程；通过 HTTP 访问 fuyao/agentcenter 的 API 服务。
- **存储**：版本缓存为本地文件（按平台分文件），路径在项目目录或 OMO dataPath。

### 4.5 场景（4+1）

- **场景 1**：用户选择平台 Agent 并发送消息 → 后端检测到该 agent 有更新 → Toast「可执行 /platform-sync 更新」。
- **场景 2**：用户执行 /platform-sync → 返回「以下 Agent 有更新：…」或「当前与平台一致」；用户带 force_refresh 再执行 → 缓存更新并提示重开会话/重启。
- **场景 3**：用户编辑 Agent 后执行发布 → 上传到平台并更新本地 version-cache。
- **场景 4**：用户使用平台 Agent A，A 的 subagents 含 B；用户通过 delegate_task 调用 B → 仅当 B 在 A 的 subagents 列表内才允许执行。

---

## 5. DFX 分析

| 维度 | 说明 |
|------|------|
| **性能** | 平台列表拉取在 config 合并时执行（启动/刷新一次性）；发消息时版本校验异步、可防抖（同一 session+agent 仅提示一次）。 |
| **可用性** | 版本更新通过 Toast 与同步 tool 返回文案双通道提示；force_refresh 更新本地缓存；发布成功后写 version-cache。 |
| **安全** | 连接与鉴权由实现侧管理，对用户黑盒、不暴露；平台请求不落敏感日志。 |
| **可扩展** | 新增平台：增加 platforms/xxx.ts 与配置段，api 按 platformType 分发；version-cache、config-bridge 与平台解耦。 |
| **可维护** | 修改点与新增文件见 3.2、3.3；版本校验实现见附录 8.4；平台 API 约定见附录 7。 |

---

## 6. 测试分析

本节给出**完整测试项**，并与当前工程中的测试实现对应；未覆盖项可作为后续补充用例。

**测试策略**：功能测试覆盖单点行为与返回值；集成测试覆盖 config 合并、event 与 tool 注册链路；边界与异常覆盖容错与降级。平台/Skill 市场当前为 Mock，测试基于 mock 数据与本地文件；对接真实 API 后需补充网络/鉴权相关用例。

---

### 6.1 功能测试（平台 Agent 对接）

| 序号 | 用例 | 预期 | 测试文件 | 状态 |
|------|------|------|----------|------|
| F1 | 启用 platform_agent 并配置 fuyao | config 合并后 config.agent 包含平台拉取的 agent（如 fuyao:CodeHelper、fuyao:DocAgent）；version-cache 写入对应平台文件（.platform-agent-cache-fuyao.json）。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| F2 | platforms 含 agentcenter | 拉取 agentcenter 列表并合并；config.agent 含 agentcenter:*；缓存使用 agentcenter 的 key。platforms 可同时含 fuyao 与 agentcenter。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| F3 | 用户配置 agents 中手写 platform:name 覆盖 | 合并顺序为「平台为底、用户覆盖」；config.agent 中该 key 体现用户覆盖的 prompt/skills/mcps/subagents。 | config-handler.test.ts（可扩展） | 待覆盖 |
| F4 | 执行 platform_agent_publish | 请求体含 name、prompt、model、skills、mcps、subagents（openCodeAgentToPlatformApp）；成功后 version-cache 中该 name 的 version 更新。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| F5 | 执行 platform_agent_sync 无 force_refresh | 返回「当前与平台一致」或「以下 Agent 有更新：…」列表。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| F6 | 执行 platform_agent_sync force_refresh=true | 缓存被覆盖为当前平台列表版本；返回「已刷新到平台最新，共 N 个应用。」。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| F7 | 用户发消息且当前为平台 Agent 且平台有更新 | 收到 Toast「Agent 有更新…可执行 /platform-sync」；同一 session+agent 防抖仅提示一次。 | 需 mock index event + showToast | 待覆盖 |
| F8 | 平台 Agent 配置 subagents 后 delegate_task | 仅 subagents 列表内的 agent 可作为 subagent_type 被调用；getSubagentsFromEntry 正确返回 entry.subagents 或 entry.options.subagents。 | platform-agent-functional.test.ts（getSubagentsFromEntry）；delegate-task 执行路径可另测 | ✓ 白名单逻辑已覆盖 |
| F9 | getAgentToolRestrictions(平台 agent 名) | 返回默认允许（如 `{}`），平台 agent 不在内置表时走默认。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| F10 | default_agent 与 persistDefaultAgent | config-handler 设置 config.default_agent；message.updated（主会话+user）时 persistDefaultAgent 写回配置文件。 | config-handler.test.ts / 需 event mock | 部分覆盖（config 侧） |
| F11 | platform-publish / platform-sync command | BuiltinCommandName 含 platform-publish、platform-sync；loadBuiltinCommands 返回对应 command 定义。 | src/features/builtin-commands/commands.test.ts | ✓ 已覆盖 |
| F12 | getPlatformAgentDetail(id/name+version) | api 层有适配器则调 getAgentDetail，否则从 list 查找；返回单条 PlatformAgentApp 或 null。 | src/features/platform-agent/api.test.ts | ✓ 已覆盖 |

---

### 6.2 功能测试（version-cache 与 config-bridge）

| 序号 | 用例 | 预期 | 测试文件 | 状态 |
|------|------|------|----------|------|
| V1 | getCacheFilePath(platformType, directory) | 返回 directory 下 `.platform-agent-cache-<platformType>.json`。 | version-cache.test.ts | ✓ 已覆盖 |
| V2 | readVersionCache 文件不存在 | 返回 `{}`，不抛错。 | version-cache.test.ts | ✓ 已覆盖 |
| V3 | readVersionCache 文件损坏或非对象 | 返回 `{}`，不中断流程（设计 6.3）。 | version-cache.test.ts | ✓ 已覆盖 |
| V4 | writeVersionCache 后 readVersionCache | 往返一致，按平台分文件。 | version-cache.test.ts | ✓ 已覆盖 |
| V5 | platformAppToOpenCodeAgent / platformAppsToAgentRecord | 将 PlatformAgentApp 转为 OpenCode 条目，key 为 platform:name，entry.name 与 key 一致。 | src/features/platform-agent/config-bridge.test.ts | ✓ 已覆盖 |
| V6 | openCodeAgentToPlatformApp | 将 OpenCode entry（platform:name）转为 PlatformAgentApp，含 prompt、skills、mcps、subagents。 | src/features/platform-agent/config-bridge.test.ts | ✓ 已覆盖 |

---

### 6.3 功能测试（Skill 市场与注入）

| 序号 | 用例 | 预期 | 测试文件 | 状态 |
|------|------|------|----------|------|
| S1 | getSkillMarketList / getSkillMarketListAll | 返回分页或全量列表（当前 mock）；支持 query 过滤。 | skill-market 若有单测则覆盖 | 待覆盖 |
| S2 | downloadSkillToMarket(skillId) | 在 getMarketSkillsDir()/<skillId>/ 下创建目录并写入 SKILL.md（或解压包）；返回 skillName、localPath。 | 可加 skill-market api 单测 | 待覆盖 |
| S3 | isSkillDownloaded(skillId) | 目录存在且含 SKILL.md 返回 true，否则 false。 | 同上 | 待覆盖 |
| S4 | discoverOpencodeGlobalSkills 含 market 目录 | getMarketSkillsDir() 下子目录被 loadSkillsFromDir 扫描，市场 skill 进入 config.command。 | opencode-skill-loader loader.test.ts | 已由 loader 实现保证，可显式断言 |
| S5 | skill_inject_to_agent(agent_key, skill_id) | 解析 market 条目 name；可选 downloadSkillToMarket；persistAgentSkill(agent_key, skillName) 写回配置。 | 可加 skill-inject-to-agent tool 单测 | 待覆盖 |
| S6 | persistAgentSkill(agentKey, skillName) | 读 OMO 配置，agents[agentKey].skills 追加 skillName，写回文件；不重复追加。 | src/shared/persist-agent-skill.test.ts | ✓ 已覆盖 |

---

### 6.4 配置与安装相关测试

| 序号 | 用例 | 预期 | 测试文件 | 状态 |
|------|------|------|----------|------|
| C1 | schema：platform_agent、default_agent、agents catchall | PlatformAgentConfigSchema 含 enabled、platforms；default_agent 可选字符串；agents 支持动态 key 与 subagents/mcps。 | config/schema.test.ts | 待覆盖 |
| C2 | install 默认写入 platform_agent、default_agent | generateModelConfig() 返回值含 platform_agent: { enabled: true, platforms: ["fuyao","agentcenter"] }、default_agent: "sisyphus"。 | cli/model-fallback.test.ts | 待覆盖 |
| C3 | writeOmoConfig 增量合并 | 目标文件已存在时 deepMerge(newConfig, existing)，existing 覆盖 newConfig，仅补充缺失项。 | cli/config-manager 相关测试 | 待覆盖 |

---

### 6.5 集成测试

| 序号 | 用例 | 预期 | 测试文件 | 状态 |
|------|------|------|----------|------|
| I1 | config 加载链路：启用 platform_agent，platforms 单平台/双平台 | 完整走 createConfigHandler → handler(config)；断言 config.agent 含对应平台 key、config.default_agent 正确；version-cache 文件存在且内容为 name→version。 | platform-agent-functional.test.ts（F1/F2 已覆盖部分） | ✓ 已覆盖 |
| I2 | config 加载链路：关闭 platform_agent 或 platforms 为空 | config.agent 不包含平台 key；不写入 version-cache。 | 可扩展 config-handler.test.ts | 待覆盖 |
| I3 | event message.updated + 平台 agent 版本校验 | 主会话、role=user、当前 agent 为平台 agent 时，异步拉列表与缓存比对；有更新时调用 ctx.client.tui.showToast；防抖后同 session+agent 不重复 Toast。 | 需在 index 或插件入口 mock event 与 client.tui | 待覆盖 |
| I4 | tool 注册：platform_agent_publish、platform_agent_sync、skill_inject_to_agent | 插件返回的 tool 对象包含上述 key，且 execute 可调用。 | index.test.ts 或工具层单测 | 部分（tool execute 已单测） |

---

### 6.6 边界与异常

| 序号 | 场景 | 预期 | 测试文件 | 状态 |
|------|------|------|----------|------|
| E1 | 网络失败 / 平台超时 | config-handler 不崩溃，降级为不合并该平台列表或保留上次缓存；platform_agent_sync 返回错误文案（如 "Sync failed: ..."）。 | 需 mock getPlatformAgentList reject | 待覆盖 |
| E2 | 鉴权失败或平台 401/403 | 实现侧记录日志并返回明确错误，不写脏缓存；不向用户暴露鉴权细节。 | 适配器内 mock 返回失败 | 待覆盖 |
| E3 | 平台返回非预期结构 | 解析 list/detail 时做字段校验与异常捕获，不导致 config 合并中断。 | 可 mock 适配器返回畸形数据 | 待覆盖 |
| E4 | version-cache 文件损坏或缺失 | readVersionCache 返回 `{}`，不抛错、不中断。 | version-cache.test.ts | ✓ 已覆盖 |
| E5 | platform_agent_sync 未配置该平台 | platform 不在 pluginConfig.platform_agent.platforms 时返回「Platform "xxx" is not in configured platforms」。 | platform-agent-functional.test.ts | ✓ 已覆盖 |
| E6 | platform_agent_publish agent_name 非 platform:name | 返回 Error 文案，要求 fuyao:Name 或 agentcenter:Name。 | platform-agent-functional.test.ts | ✓ 已覆盖 |

---

### 6.7 测试实现说明

**已实现的测试文件与运行方式**：

| 测试文件 | 覆盖范围 | 运行命令 |
|----------|----------|----------|
| `src/features/platform-agent/version-cache.test.ts` | version-cache 读/写/路径、文件缺失与损坏（V1–V4、E4） | `bun test src/features/platform-agent/version-cache.test.ts` |
| `src/features/platform-agent/platform-agent-functional.test.ts` | F1–F2、F4–F6、F8–F9、E5–E6（config 合并、publish/sync、subagents、getAgentToolRestrictions、sync 未配置平台、publish 非法 agent_name） | `bun test src/features/platform-agent/platform-agent-functional.test.ts` |
| `src/features/platform-agent/config-bridge.test.ts` | V5–V6（platformAppToOpenCodeAgent、platformAppsToAgentRecord、openCodeAgentToPlatformApp） | `bun test src/features/platform-agent/config-bridge.test.ts` |
| `src/features/platform-agent/api.test.ts` | F12（getPlatformAgentList、getPlatformAgentDetail by id/name） | `bun test src/features/platform-agent/api.test.ts` |
| `src/features/builtin-commands/commands.test.ts` | F11（platform-publish、platform-sync command 注册与 disabled） | `bun test src/features/builtin-commands/commands.test.ts` |
| `src/shared/persist-agent-skill.test.ts` | S6（persistAgentSkill 写回配置、不重复追加） | `bun test src/shared/persist-agent-skill.test.ts` |

**运行全部平台对接相关用例**：

```bash
bun test src/features/platform-agent/
```

**覆盖汇总**：

- **已覆盖**：F1–F2、F4–F6、F8–F9、F11、F12；V1–V6；S6；E4、E5、E6；平台 agent 合并与 version-cache、publish/sync、getAgentToolRestrictions、getSubagentsFromEntry、config-bridge 转换、command 注册、getPlatformAgentDetail、persistAgentSkill、sync/publish 边界。
- **待覆盖**：用户覆盖合并顺序（F3）、发消息时版本校验 Toast（F7）、default_agent 持久化 event 路径（F10）；Skill 市场列表/下载/注入（S1–S5）；配置与 install（C1–C3）；集成 I2–I4；边界 E1–E3。

---

## 7. 附录：平台 API 约定（最小集合）

| 用途 | 方法 | 说明 |
|------|------|------|
| 获取可用 Agent 列表 | GET | 返回应用列表，每项含 id、name、version、prompt、model、permission、mode、skills、mcps、subagents、updatedAt 等。 |
| 获取单个应用详情 | GET | 按 id 或 name+version 返回完整信息。 |
| 发布/更新应用 | POST/PUT | Body：name、prompt、model、permission、mode、skills、mcps、subagents 等；响应含 version 或确认。 |

- 鉴权与连接：由实现侧在 platforms/fuyao.ts、agentcenter.ts 内按环境或内部配置解析，不对用户暴露；path 差异在各 adapter 内适配。

---

## 8. 附录：版本校验与用户提示（实现要点）

实现顺序见 8.4。

### 8.1 版本数据来源与缓存

- **平台侧**：列表/详情返回每应用的 name、version。
- **本地**：version-cache 按平台存 `Record<agentName, version>`；**写入时机**：① config-handler 合并平台列表后 `writeVersionCache(platformType, listToVersionMap)`；② platform_agent_publish 成功后更新对应 name 的 version。

### 8.2 校验时机与提示方式

| 时机 | 实现位置 | 提示方式 |
|------|----------|----------|
| 用户发消息且当前为平台 Agent | index.ts 的 event 或 hook | `ctx.client.tui.showToast({ body: { title, message, variant, duration } })` |
| 用户执行 platform_agent_sync | platform-agent-sync tool | execute 返回字符串（与平台一致 / 有更新列表 / 已刷新） |

### 8.3 校验步骤（共用）

1. 读 pluginConfig.platform_agent；未启用或 platforms 为空则跳过。
2. 按需对某 platform（或遍历 platforms）：`list = await getPlatformAgentList(platformType)`；`cached = readVersionCache(platformType)`。
3. 对需检查的 name：`remoteVersion = list.find(a => a.name === name)?.version`；`localVersion = cached[name]`；若 remoteVersion 存在且与 localVersion 不同则视为有更新。

### 8.4 逐步实现清单（可直接照做）

**Step 1：version-cache.ts**  
- 缓存文件：`getCacheFilePath(platformType)` → `".platform-agent-cache-" + platformType + ".json"`（路径用 ctx.directory 或 dataPath）。  
- `readVersionCache(platformType)`：存在则 `JSON.parse(readFileSync(…))`，否则 `{}`。  
- `writeVersionCache(platformType, versions)`：`writeFileSync(…, JSON.stringify(versions, null, 2))`。

**Step 2：config-handler.ts**  
- 在「拉取平台列表并合并进 config.agent」之后：`versionMap = Object.fromEntries(platformList.map(a => [a.name, a.version]))`；`await writeVersionCache(platformType, versionMap)`。

**Step 3：发消息时校验 + Toast**  
- event 中 `message.updated` 且 role===user 且存在 agent：未启用平台或 cached[agent] 不存在则 return；拉列表取 remote；若 `remote.version !== cached[agent]` 则 `ctx.client.tui.showToast({ body: { title: "Agent 有更新", message: "「"+agent+"」已有新版本，可执行 /platform-sync 更新。", variant: "info", duration: 5000 } })`。防抖：Map<sessionID, Set<agentName>> 记录已提示。

**Step 4：platform_agent_sync execute**  
- 入参 platform_type、force_refresh。拉列表、读缓存；outdated = list.filter(a => cached[a.name] !== a.version)。若 force_refresh 则写缓存并返回「已刷新到平台最新，共 N 个应用…」；否则有 outdated 则返回「以下 Agent 有更新：…」；否则「当前与平台一致。」

**Step 5：platform_agent_publish 成功后**  
- 拿到响应 version 后：`cached = await readVersionCache(platformType)`；`cached[agentName] = newVersion`；`writeVersionCache(platformType, cached)`。

---

## 9. 附录：打包并集成到 OpenCode

### 9.1 前提

- OpenCode 通过**配置目录**下的 `opencode.jsonc` 的 `plugin` 数组加载插件；插件名从该目录的 `node_modules` 解析。
- 使用 **npm/bun 全局安装的 OpenCode** 时，配置目录为**全局目录**（见下表），与是否在项目里打开无关。
- 包名：`fuyao-opencode`；项目目录名：`fuyao-opencode-omo`。

### 9.2 使用 npm 安装的 OpenCode 集成 fuyao-opencode（推荐流程）

适用于已通过 `npm install -g opencode` 或 `bun install -g opencode` 安装的 OpenCode，在任意项目里都会加载同一套全局插件。

**第一步：构建 fuyao-opencode**（仅当从源码集成时需要）

在项目根目录执行：

```bash
cd <你的路径>/fuyao-opencode-omo
bun run build
```

产物在 `dist/`。插件的 `package.json` 中入口为 `main: "dist/index.js"`，OpenCode 加载插件时只会执行该文件，因此从源码集成时必须先执行本步，否则插件无法加载或会运行旧代码。

**打包时若只有 npm/npx（没有 Bun）**：当前构建脚本依赖 Bun（`bun run build`）。若本机只有 npm/npx，可：① `npm install -g bun` 后用 `bun run build` 构建。

**第二步：找到 OpenCode 的全局配置目录**

| 系统   | 配置目录（优先）           | 备选（若上者无配置文件）     |
|--------|----------------------------|------------------------------|
| Windows | `%USERPROFILE%\.config\opencode` | `%APPDATA%\opencode`         |
| macOS/Linux | `~/.config/opencode`       | -                            |

也可设置环境变量 `OPENCODE_CONFIG_DIR` 指定目录。若目录不存在，可先创建并放入空的 `opencode.jsonc`（见下一步），OpenCode 首次启动时会在此目录创建 `package.json` 并安装依赖。

**第三步：安装并声明插件**

在**配置目录**下完成两件事（须先完成第一步构建）：

1. **安装包**：`bun init -y` 或 `npm init -y`（若无 package.json），再执行 `bun add "file:<fuyao-opencode-omo 绝对路径>"` 或 `npm install "file:<路径>"`，使该目录下存在 `node_modules/fuyao-opencode`。
2. **声明插件**：在 `opencode.json` 或 `opencode.jsonc` 的 `plugin` 数组中加入 `"fuyao-opencode"`。

可选：执行 `bun node_modules/fuyao-opencode/dist/cli/index.js install` 自动完成 (2) 并引导生成 fuyao-opencode.json、provider 等，无需手动编辑。

**第四步：启动与使用**

执行 `opencode` 启动。首次打开时插件可能尚未完整加载，agent 未出现在列表；**发一条消息**触发加载后**关闭并重新打开** OpenCode，agent（Sisyphus、Hephaestus 等）即会出现在列表中。

**后续更新 fuyao-opencode 代码时**

每次在代码仓拉取或修改 fuyao-opencode 后，需要做两处更新，否则 OpenCode 可能仍加载旧版本：

1. **在 fuyao-opencode-omo 仓库目录**：执行 `bun run build`，重新生成 `dist/`。
2. **在 OpenCode 配置目录**：执行 `bun install`（使用 npm 则为 `npm install`）。配置目录的 `package.json` 里已经是 `"fuyao-opencode": "file:..."`，**不需要再写一次 file: 或重新 add**；在配置目录执行一次 `bun install` 会重新解析依赖并从该路径拉取最新内容。。

然后再启动或重启 OpenCode 即可生效。

**agent 未出现 / 未生效时**：先按第四步确认已发消息并重启；再检查：plugin 与 node_modules 已配置、~/.cache/fuyao-opencode 下存在 connected-providers.json / provider-models.json（若无可执行 `opencode models --refresh` 后重启）、OpenCode 有可用 model、fuyao-opencode.json 中未将对应 agent 设为 disabled。agent 未配 model 时由 OpenCode 兜底为当前选中模型。

### 9.3 多插件与优先级（如何知道用的是哪个、顺序是否覆盖）

**可以安装多个插件。** `opencode.jsonc` 的 `plugin` 是数组，例如：

```jsonc
"plugin": ["oh-my-opencode", "fuyao-opencode"]
```

**谁被加载？**  
- **不同包名**：都会加载。OpenCode 按数组顺序依次 `import` 并执行每个插件的 hook（config、tool、event 等），**两个插件都会生效**，不是二选一。  
- **相同包名**（例如多处配置里都写了 `oh-my-opencode`）：OpenCode 会**按名去重**，**只保留一份**。保留的是**优先级更高的那一份**（见下）。

**配置优先级（谁覆盖谁）**  
OpenCode 合并多级配置（全局、项目、本地 plugin 目录等）时，**后合并的覆盖先合并的**。去重时规则是：**同一包名只保留“后出现”的那条**（即更高优先级来源的版本）。  
优先级从高到低一般为：本地 `plugin/` 目录 > 本地 `opencode.json(c)` > 全局 `plugin/` > 全局 `opencode.json(c)`。

因此：  
- 若 `plugin` 里同时有 `oh-my-opencode` 和 `fuyao-opencode`，**两个都会加载**；两者注册的 agent/tool/command 会一起存在，config 上后执行的插件会对同一字段覆盖先执行的。  
- 若只想用 fuyao-opencode、不用 oh-my-opencode，从 `plugin` 数组里**删掉** `"oh-my-opencode"` 即可。  
- 若希望 fuyao-opencode 的配置覆盖 oh-my-opencode，把 `"fuyao-opencode"` 放在 **`oh-my-opencode` 后面**（即 `["oh-my-opencode", "fuyao-opencode"]`），这样 fuyao-opencode 的 config hook 后执行，对同一 key 会覆盖前者。

**如何确认当前用的是哪个插件？**  
- 看 `~/.config/opencode/opencode.jsonc`（或当前生效的配置）里的 `plugin` 数组：列表里的都会加载。  
- 同名的只保留一条（按上面优先级）。  
- 若两个不同名插件都注册了同名 agent/command，后加载的插件会覆盖先加载的同名项（取决于 OpenCode 的合并实现）；通常建议只启用需要的那几个插件，避免重复能力冲突。

---

**可选：用 npm link 代替 file: 安装**

1. 在 fuyao-opencode-omo 根目录：`npm link`
2. 进入配置目录：`cd <配置目录>`，然后 `npm link fuyao-opencode`
3. 同样在 `opencode.jsonc` 的 `plugin` 中加入 `"fuyao-opencode"`。

### 9.4 发布给用户：是否必须发到 npm？

**不必。** 有两种常见做法，任选其一即可。

| 方式 | 适用场景 | 用户安装方式 |
|------|----------|-----------------------------|
| **发布到 npm** | 希望用户用 `bun add fuyao-opencode` / `npm i fuyao-opencode`，体验与常见前端依赖一致；便于版本与发现。 | 在 OpenCode 配置目录执行：`bun add fuyao-opencode` 或 `npm install fuyao-opencode`，再在 `opencode.jsonc` 里写 `"plugin": ["fuyao-opencode"]`。 |
| **从 GitHub 安装（不发 npm）** | 不想维护 npm 包、或只给内部/指定用户用；仓库公开即可。 | 在 OpenCode 配置目录执行：`bun add github:Cogather/fuyao-opencode-omo` 或 `npm install git+https://github.com/Cogather/fuyao-opencode-omo.git`，再在 `opencode.jsonc` 里写 `"plugin": ["fuyao-opencode"]`。安装后包名仍为 `fuyao-opencode`（取自 package.json 的 `name`），插件名不变。 |

**说明：**

- 发到 **npm**：在项目里执行 `npm publish`（需 npm 账号、登录）。用户安装后可直接用包名 `fuyao-opencode`，适合对外公开发布、版本语义化（如 `fuyao-opencode@1.0.0`）。
- **仅用 GitHub**：不执行 `npm publish`。用户通过 `bun add github:Cogather/fuyao-opencode-omo` 或 `npm install git+https://github.com/Cogather/fuyao-opencode-omo.git` 安装，依赖你打的 tag（如 `#v1.0.0`）或默认用默认分支。适合先小范围分发或内部使用。

无论哪种方式，用户侧在 `opencode.jsonc` 里都是写 `"plugin": ["fuyao-opencode"]`，无需区分安装来源。

### 9.5 plugin 是否要用户手动写？

**install 为可选便捷步骤。** fuyao-opencode 自带 install 命令，可**自动**把 `"fuyao-opencode"` 写入 OpenCode 配置目录的 `opencode.jsonc` / `opencode.json` 的 `plugin` 数组，并可选生成 fuyao-opencode.json；不执行 install 时在配置目录手动添加即可。

- **推荐用户流程（自动写入）**：先安装包（npm/GitHub/file 任选），再运行  
  `bunx fuyao-opencode install`  
  或（已全局安装时）`fuyao-opencode install`  
  安装器会写入 `plugin` 并引导配置 fuyao-opencode.json（模型等）。无需用户手动编辑 `opencode.jsonc` 的 plugin。
- **仅装包、不跑安装器**：若用户只在**配置目录**执行了 `bun add fuyao-opencode`（或从 GitHub 安装）而**没有**执行 install，则需**手动**在该配置目录的 `opencode.jsonc`（或 `opencode.json`）里添加 `"plugin": ["fuyao-opencode"]`，否则 OpenCode 不会加载该插件。注意：必须在 **OpenCode 的全局配置目录** 做 bun add 和写 plugin，在项目目录操作不会生效。

结论：**install 非必须**，仅用于自动写入 plugin 与 fuyao-opencode.json 等配置，省去手动编辑。手动在配置目录完成「bun add + plugin 里加 fuyao-opencode」即可；装包后不跑 install 时需手动加 plugin。首次使用需**发一次消息**触发插件完整加载，**重启 OpenCode** 后 agent 才会出现在列表。


### 9.6 小结

| 步骤     | 说明 |
|----------|------|
| 构建     | 在 `fuyao-opencode-omo` 下执行 `bun run build`。 |
| 配置目录 | Windows: `%USERPROFILE%\.config\opencode` 或 `%APPDATA%\opencode`；macOS/Linux: `~/.config/opencode`。**bun add 与 plugin 必须在此目录**，在项目目录操作不会生效。 |
| 安装插件 | 在**上述配置目录**执行 `bun add "file:..."` 或 `npm install fuyao-opencode` 等。**install 非必须**，可选执行 `bun node_modules/fuyao-opencode/dist/cli/index.js install` 自动写入 plugin 与 fuyao-opencode.json。 |
| 声明插件 | 在配置目录的 `opencode.jsonc` 或 `opencode.json` 中设置 `"plugin": ["fuyao-opencode"]`；不跑 install 时需手动加。 |
| 使用     | 运行 `opencode` 后，**发一次消息**触发插件完整加载，**关闭并重新打开 OpenCode** 后 agent 才会出现在列表。 |
| 发布给用户 | 可选：发布到 npm 或从 GitHub 安装，无需强制发 npm。 |
| plugin 手写？ | install 会自动写入 `plugin` 与可选配置；不跑 install 时需在配置目录手动加 `"fuyao-opencode"`。 |
| 只有 npm/npx | 用户：`npm install fuyao-opencode`（或从 GitHub 安装），可选 `npx fuyao-opencode install`。开发者构建：可先 `npm install -g bun` 再 `bun run build`，或使用 GitHub 安装不本地构建。 |

按上述步骤即可在「npm 安装的 OpenCode」中集成并日常使用 fuyao-opencode；对外分发时可选 npm 或仅 GitHub。插件**设计范围内能力已全部实现**（含平台列表/详情/发布、version-cache、发布/同步、版本校验 Toast、Skill 市场列表/下载/注入）；**当前为 Mock 的能力**及后期替换要点见**第 11.5 节**。

---

## 10. 修改记录

| 日期 | 修改内容 |
|------|----------|
| 2025-02 | **平台 agent 列表不回写**：明确平台 agent 列表仅在运行时合并进 `config.agent`，不会回写到用户配置的 `agents`。 |
| 2025-02 | **手动覆盖**：支持在 `agents` 中手写平台 agent key（`platform:name`），用于覆盖运行时、配置 skills/mcps/subagents；合并时以运行时为底、用户配置覆盖。 |
| 2025-02 | **Schema**：`agents` 支持动态 key（`AgentOverridesSchema.catchall`）；`AgentOverrideConfigSchema` 增加 `subagents`、`mcps`。 |
| 2025-02 | **config-handler**：用户覆盖来源改为 `pluginConfig.agents`；平台 key 与用户配置按 key 合并（平台底 + 用户覆盖）。 |
| 2025-02 | **平台 agent key 与 entry.name**：config key 为 `platform:name`（与 mock name 一致）；`entry.name` 与 key 一致以便 OpenCode 按 `agent.name` 查找不报错。 |
| 2025-02 | **install 增量写入**：`writeOmoConfig` 使用 `deepMerge(newConfig, existing)`，已有配置不覆盖，仅补充缺失项。 |
| 2025-02 | **platform_agent 默认写入**：`generateModelConfig` 在无 provider 的 early return 中补写 `platform_agent`，保证 install 后配置中必有该段。 |
| 2025-02 | **default_agent**：Schema 增加 `default_agent`；config-handler 从 `pluginConfig.default_agent` 读取并设置 `config.default_agent`；install 默认写入 `default_agent: "sisyphus"`。 |
| 2025-02 | **default_agent 持久化**：新增 `shared/persist-default-agent.ts`，在 `message.updated`（主会话 + user 消息）时将当前 agent 写入配置的 `default_agent`，下次启动沿用；OpenCode 不自动写回，仅 OMO 通过事件持久化。 |
| 2025-02 | **Skill 市场对接（设计）**：新增 3.10 节，描述对接 Skill 市场获取可选 skill 列表、选择 skill 注入到指定 agent、以及将 skill 下载到约定位置（`configDir/skills/market/<skillId>/`）的实现思路；与 opencode-skill-loader 发现链路衔接、数据模型与 API 抽象、涉及文件与阶段建议。 |
| 2025-03 | **设计文档与代码一致性**：新增第 11 节「设计文档与代码一致性检查」；修正 3.3 目录为 `src/features/platform-agent/` 并标注当前实现状态。 |
| 2025-03 | **文档优化**：文档开头增加「文档与实现一致性」说明；3.1/3.2 表格增加「实现状态」列；2 节分层与数据流补充已实现/未实现标注；9.6 小结区分阶段一与阶段二；11.4 增加快速对照说明。 |
| 2025-03 | **对原 OMO 的修改说明**：新增 **3.2.0 对原 OMO 的修改说明（逐文件）**，集中列出 config-handler、schema、index、delegate-task/executor、model-fallback、config-manager、persist-default-agent 等修改/新增内容及实现状态，便于合入上游与冲突排查。 |
| 2025-03 | **配置项与 Prompt 修改**：新增 **3.2.0.1 配置项新增与默认值**（platform_agent、default_agent、skill_availability、subagent_availability、agents 动态 key、AgentOverrideConfigSchema 扩展及 install 默认值）；新增 **3.2.0.2 Prompt 相关修改**（平台 mock 系统提示词、config-bridge prompt 映射、与 OMO prompt 逻辑的关系）。 |
| 2025-03 | **实施完成（阶段二～四）**：实现 version-cache（constants、version-cache.ts）、config-handler 合并后写 version-cache；openCodeAgentToPlatformApp、publishPlatformAgent 及适配器 publishAgent（mock）；platform_agent_publish、platform_agent_sync 两 tool 及 platform-publish、platform-sync command；message.updated 平台版本校验与 showToast（防抖）。设计文档第 11 节与 3.1/3.2/3.3 已更新为「已完成」；11.3 仅保留 getAgentDetail、真实 API、Skill 市场等待实现项。 |
| 2025-03 | **剩余能力补齐与 Mock 标注**：实现 getAgentDetail（接口 + api + fuyao/agentcenter 适配器 mock）；新增 platforms/types.ts（re-export）；Skill 市场注入：persistAgentSkill（shared）、skill_inject_to_agent tool，并确认 skill-market 列表/下载与 opencode-skill-loader 扫描 market 已存在。设计文档更新为「设计范围内能力已全部实现」；新增 **11.5 Mock 能力与后期改造要点**，明确列出需替换为真实 API 的 5 项（平台列表/详情/发布、Skill 市场列表/下载）及对应文件与改造要点。 |

---

## 11. 设计文档与代码一致性检查

本节对照设计文档与当前代码，列出**已实现**与**未实现/不一致**项，便于维护与排期。

### 11.1 路径与目录

| 设计文档描述 | 实际代码位置 | 说明 |
|--------------|--------------|------|
| `src/platform-agent/` | `src/features/platform-agent/` | 文档 3.3 原写为 `src/platform-agent/`，实际在 `features` 下；已在上文 3.3 中修正说明。 |
| `src/tools/platform-agent-publish/`、`platform-agent-sync/` | `src/tools/platform-agent-publish/`、`src/tools/platform-agent-sync/` | ✓ 已实现。 |
| `src/hooks/platform-agent-version-check/` | 未单独建 hook | 版本校验在 index 的 message.updated 中实现，无需独立 hook。 |

### 11.2 已实现且与设计一致

| 项目 | 位置 | 说明 |
|------|------|------|
| **platform_agent 配置** | `src/config/schema.ts` | `PlatformAgentConfigSchema`：`enabled`、`platforms: ["fuyao","agentcenter"]`。 |
| **install 默认写入 platform_agent** | `src/cli/model-fallback.ts` | `platform_agent: { enabled: true, platforms: ["fuyao", "agentcenter"] }`。 |
| **config-handler 拉取、合并与写 version-cache** | `src/plugin-handlers/config-handler.ts` | `loadPlatformAgents(pluginConfig, ctx.directory)` 遍历 platforms、拉取并合并，每平台合并后 `writeVersionCache(platform, versionMap, directory)`。 |
| **platform-agent 模块** | `src/features/platform-agent/` | types、api（getPlatformAgentList、**getPlatformAgentDetail**、publishPlatformAgent）、config-bridge、version-cache、constants、platforms（getAgentList、**getAgentDetail**、publishAgent；当前均为 **Mock**）、**platforms/types.ts**（re-export）、index。 |
| **version-cache** | `src/features/platform-agent/version-cache.ts` | getCacheFilePath、readVersionCache、writeVersionCache；按平台分文件，目录为 ctx.directory。 |
| **constants** | `src/features/platform-agent/constants.ts` | PLATFORM_AGENT_CACHE_PREFIX。 |
| **platform_agent_publish / platform_agent_sync tool** | `src/tools/platform-agent-publish/`、`src/tools/platform-agent-sync/` | createPlatformAgentPublishTool、createPlatformAgentSyncTool；index 注册为 platform_agent_publish、platform_agent_sync。 |
| **platform-publish / platform-sync command** | `src/features/builtin-commands/commands.ts`、`types.ts`；`src/config/schema.ts` | BuiltinCommandName 与 BuiltinCommandNameSchema 含 platform-publish、platform-sync；commands 含对应 template。 |
| **发消息时版本校验 + Toast** | `src/index.ts` | message.updated 且主会话 + user 时，若 agent 为平台 agent 则异步 getPlatformAgentList + readVersionCache 比对，有更新则 showToast；防抖 Map<sessionID, Set<agentName>>；session.deleted 时清理。 |
| **openCodeAgentToPlatformApp / publishPlatformAgent** | config-bridge、api、adapters | openCodeAgentToPlatformApp 将 OpenCode entry 转为 PlatformAgentApp；publishPlatformAgent 调用 adapter.publishAgent 或 mock；fuyao/agentcenter 适配器已实现 publishAgent（mock）。 |
| **agents 动态 key 与覆盖** | `src/config/schema.ts` | `AgentOverridesSchema.catchall`、`AgentOverrideConfigSchema` 含 `subagents`、`mcps`；合并顺序与 3.9.2 一致。 |
| **delegate_task subagents 白名单** | `src/tools/delegate-task/executor.ts` | `resolveSubagentExecution` 中按 parent 的 `subagents`（getSubagentsFromEntry）过滤 callableAgents。 |
| **平台 agent 的 tool 限制** | `src/shared/agent-tool-restrictions.ts` | 未在表内的 agent 返回 `{}`，平台 agent 等价于默认允许。 |
| **default_agent 与持久化** | schema、config-handler、persist-default-agent、index 的 message.updated | 与 3.9.4 一致。 |
| **assets schema** | `assets/fuyao-opencode.schema.json` | 存在。 |
| **getPlatformAgentDetail** | `src/features/platform-agent/api.ts`、adapters | 接口 getAgentDetail(options)；api 层有则调适配器，否则从 list 查找；fuyao/agentcenter 适配器已实现（**Mock**：从 mock 列表按 id 或 name+version 查找）。 |
| **platforms/types.ts** | `src/features/platform-agent/platforms/types.ts` | 已新增，re-export 上级 types。 |
| **Skill 市场（3.10）** | `src/features/skill-market/`、opencode-skill-loader、shared | types（SkillMarketItem）、api（getSkillMarketList、getSkillMarketListAll、downloadSkillToMarket、isSkillDownloaded）；mock-data；opencode-skill-loader 已扫描 getMarketSkillsDir()；**persistAgentSkill**（shared）写回 agents[agentKey].skills；**skill_inject_to_agent** tool（下载可选 + 注入并写配置）。列表与下载当前为 **Mock**，见 11.5。 |

### 11.3 待增强（仅替换 Mock）

| 项目 | 说明 |
|------|------|
| **平台真实 HTTP API** | 在 `platforms/fuyao.ts`、`platforms/agentcenter.ts` 中将 getAgentList、getAgentDetail、publishAgent 由 mock 改为真实 HTTP 调用；鉴权与 baseUrl 在适配器内解析，不暴露给配置。 |

其余设计项均已实现；**Mock 清单与改造要点**见 **11.5**。

### 11.4 小结与建议

- **设计范围内能力已全部实现**：平台列表/详情/合并、version-cache、发布/同步 tool 与 command、版本校验 Toast、getAgentDetail、platforms/types、Skill 市场（列表/下载/注入、skill_inject_to_agent、persistAgentSkill、loader 扫描 market 目录）。
- **后期重点**：将 11.5 中列出的 **Mock 能力** 替换为真实 API（平台 Agent 列表/详情/发布、Skill 市场列表/下载）。

**快速对照**：文档开头已对「设计 vs 当前实现」做简要说明；**Mock 与改造要点**以 **11.5** 为准。

### 11.5 Mock 能力与后期改造要点

以下能力**当前为 Mock 实现**，对接真实后端时需**重点修改**对应文件与接口，保证请求/响应与设计一致（如附录 7、3.10.4）。

| 能力 | 当前实现（Mock） | 后期改造要点 |
|------|------------------|--------------|
| **平台 Agent 列表** | `platforms/fuyao.ts`、`platforms/agentcenter.ts` 的 `getAgentList` 返回 `MOCK_FUYAO_AGENTS` / `MOCK_AGENTCENTER_AGENTS`。 | 替换为 GET 平台列表 API；响应映射为 `PlatformAgentApp[]`（id、name、version、prompt、model、skills、mcps、subagents 等）；鉴权在适配器内处理。 |
| **平台 Agent 详情** | 适配器 `getAgentDetail` 从 mock 列表中按 id 或 name+version 查找返回。 | 替换为 GET 平台详情 API（按 id 或 name+version）；返回单条 `PlatformAgentApp`。 |
| **平台 Agent 发布** | 适配器 `publishAgent` 直接 resolve `{ version: app.version ?? "1.0.0" }`，无网络请求。 | 替换为 POST/PUT 平台发布 API；body 含 name、prompt、model、skills、mcps、subagents 等；响应解析 version 并写 version-cache。 |
| **Skill 市场列表** | `features/skill-market/api.ts` 中 `getSkillMarketListFromMock` 返回 `MOCK_SKILL_MARKET_ITEMS`；`getSkillMarketList` 仅用 mock。 | 接入真实 Skill 市场列表/搜索 API；返回 `SkillMarketItem[]`（id、name、version、description、downloadUrl 等）；可保留分页与 query 参数。 |
| **Skill 市场下载** | `downloadSkillToMarket` 仅在本地创建目录并写入占位 `SKILL.md`，未从 downloadUrl 拉包。 | 使用 `SkillMarketItem.downloadUrl`（或平台包地址）拉取包并解压到 `getMarketSkillsDir()/<skillId>/`；保证目录内含 `SKILL.md` 及 frontmatter name。 |

**说明**：version-cache、config-handler 合并、发布/同步 tool、版本校验 Toast、openCodeAgentToPlatformApp、persistAgentSkill、skill_inject_to_agent、opencode-skill-loader 对 market 目录的扫描等**非 Mock**，无需因对接真实 API 而改动逻辑，仅需保证适配器返回结构与类型一致。

