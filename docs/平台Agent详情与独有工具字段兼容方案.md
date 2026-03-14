# 平台 Agent 详情与独有工具字段兼容方案

本文档分析真实平台 Agent 详情 API 与当前项目数据模型的对应关系，说明**常规字段**（mcpToolSet、skillSet、agentSet）的配置转化思路，以及**平台独有工具字段**（toolSet、agentToolSet、workflowToolSet）的兼容调用方案。

---

## 约束说明（重要）

**本方案仅涉及修改本仓库（fuyao-opencode-omo / OMO 插件）的代码，不涉及修改 OpenCode 源码。**

- 所有改动均在 **OMO 插件** 内完成：类型扩展、config-handler、config-bridge、platform 适配器、新增 tool 的注册、agent-tool-restrictions 等，均为插件自身实现。
- 新能力通过 OpenCode 已提供的 **插件扩展点** 实现：插件通过 `return { tool: { ... }, config: configHandler, event: ... }` 注册工具、配置钩子与事件；OpenCode 无需改动即可加载插件返回的任意新工具并调用。
- **不修改、不依赖 OpenCode 内部实现**：不 fork OpenCode 仓库，不 patch 其源码；仅依赖公开的插件 API 与配置/事件契约。

---

## 一、真实 Agent 详情字段与当前模型对照

### 1.1 真实详情中的字段（概要）

| 字段 | 类型 | 含义 | 当前项目支持情况 |
|------|------|------|------------------|
| **mcpToolSet** | JSON 数组 | MCP 运行所需配置信息 | 有对应：`mcp_definitions`（名→配置），合并进 config.mcp |
| **skillSet** | JSON 数组 | Skill 下载部署信息（skillID、skillName 等），可据此调下载接口并解压到 skill 部署目录 | 有部分对应：`skill_definitions`（名→定义）；列表/下载走 skill-market，需与 skillSet 对接 |
| **agentSet** | JSON 数组 | Subagent 运行配置 | 有对应：`subagents`（字符串数组），合并进 agent 配置 |
| **toolSet** | JSON 数组 | toolId + 描述，Agent 通过调用指定接口+约定 body 执行 | **当前未支持** |
| **agentToolSet** | JSON 数组 | 形式与用法同 toolSet | **当前未支持** |
| **workflowToolSet** | JSON 数组 | 形式与用法同 toolSet | **当前未支持** |
| **managers** | 字符串数组 | 具备该应用管理员权限的人员标识列表；仅名单内用户可发布，其他人可本地修改但不能发布 | **已支持**：PlatformAgentApp.managers + platform_agent.publish_identity 校验 |

前三个为**常规项**，后三个为**平台独有工具形态**（扶摇与 AgentCenter 均有，但接口与 body 约定由各平台定义）。

### 1.2 当前数据模型（PlatformAgentApp）与转化链路

- **类型**：`src/features/platform-agent/types.ts` 中 `PlatformAgentApp`  
  - 已有：id、name、version、prompt、model、permission、skills、mcps、subagents、skill_definitions、mcp_definitions、mode、description、**managers**（字符串数组）、tool_set、agent_tool_set、workflow_tool_set 等。  
  - managers 用于发布权限：配置项 `platform_agent.publish_identity` 与 app.managers 比对，仅名单内用户可执行发布。
- **转化**：`config-bridge.ts` 的 `platformAppToOpenCodeAgent` 只处理上述已有字段；config-handler 将 `skill_definitions` / `mcp_definitions` 合并进 config.command / config.mcp，**未处理**平台独有工具。

因此：**常规项**可通过扩展「详情 API → PlatformAgentApp」的映射（mcpToolSet→mcp_definitions、skillSet→skill_definitions/下载、agentSet→subagents）在现有架构下完成配置转化；**独有工具**需要新增类型、存储与**调用路径**才能被 OpenCode 内运行的平台 Agent 使用。

---

## 二、常规项（mcpToolSet、skillSet、agentSet）的配置转化要点

以下在对接真实详情 API 时建议的映射与落点，保证 OpenCode 能正确解析和运行。

| 真实字段 | 建议映射与落点 | 说明 |
|----------|----------------|------|
| **mcpToolSet** | 数组每项转为 `mcp_definitions[name]`，合并进 config.mcp | 与现有 `mcp_definitions` 一致；适配器内将平台 mcp 配置转成 OpenCode MCP 所需结构（如 type、url、enabled 等）。 |
| **skillSet** | ① 列表：转为 `skill_definitions` 或仅保留 skillID/skillName 等；② 下载：用现有 skill 下载接口按 skillID 拉取并解压到 `getMarketSkillsDir()/<id>/` 或约定目录；③ 若平台直接返回 skill 内容，可生成 command 定义写入 `skill_definitions` | 与现有 skill_definitions、config.command 及 skill-market 下载能力对齐；详情拉取时可按需触发「未本地存在则下载」。 |
| **agentSet** | 转为 `subagents` 字符串数组（如 `["fuyao:SubAgentA", "fuyao:SubAgentB"]`），写入 agent 配置 | 与现有 subagents、delegate_task 白名单一致；agentSet 中需能解析出平台内 agent 名或 id 并统一为 `platform:name` 形式。 |

实现时只需在 **platforms/fuyao.ts、platforms/agentcenter.ts** 的 getAgentDetail（及 getAgentList 若列表含部分详情）中，将平台返回的 **mcpToolSet → mcp_definitions**、**skillSet → skill_definitions / 下载**、**agentSet → subagents**，再经现有 config-bridge 与 config-handler 合并进 config，无需改 OpenCode 的解析与运行逻辑。

---

## 三、平台独有工具字段的兼容调用思路

### 3.1 问题本质

- **toolSet / agentToolSet / workflowToolSet**：每个元素包含 **toolId** 及**描述**；执行方式为 Agent 调用**平台约定接口 + 约定 body**（如 POST /tool/run，body 含 toolId、参数等）。
- 当前项目：插件向 OpenCode 注册的是一套**静态** tool 列表；没有「按平台、按 Agent 动态注册 N 个工具」的机制，也没有调用平台执行接口的封装。
- 目标：在**不改变 OpenCode 插件静态注册工具**的前提下，让使用平台 Agent（如 fuyao:CodeHelper）的会话能够**兼容调用**这些独有工具。

### 3.2 推荐方案：通用「平台工具调用」+ 可选「平台工具列表」

思路：不按每个 toolId 注册一个 OpenCode 工具，而是提供**一个（或少数几个）通用工具**，在 execute 内根据参数转调平台执行接口；再通过**列表工具或 prompt 注入**让 Agent 知道当前可用的 toolId 与描述。

#### 3.2.1 类型与数据扩展

- **PlatformAgentApp（或详情 DTO）** 增加可选字段，例如：
  - `tool_set?: Array<{ toolId: string; description?: string; [k: string]: unknown }>`
  - `agent_tool_set?: Array<...>`  
  - `workflow_tool_set?: Array<...>`  
  具体字段名可与平台 API 一致（toolSet / agentToolSet / workflowToolSet），在适配器内做一次映射即可。
- **存储**：  
  - 在 **config-handler** 拉取/合并平台 Agent 时，若使用「详情」数据（或列表项已含这些字段），可将每个 agent 的这三类工具集**按 agent 维度缓存**（例如 `platformToolRegistry.get(platform, agentName)`），供后续「列表」与「执行」使用。  
  - 或仅在**运行时**：当会话当前 agent 为平台 Agent 时，按需调用 getAgentDetail 取回 toolSet/agentToolSet/workflowToolSet 并缓存到会话/内存，避免每次请求都拉详情。

#### 3.2.2 平台适配层：执行接口

- 在 **IPlatformAdapter** 中增加可选方法，例如：
  - `invokeTool?(options: InvokePlatformToolOptions): Promise<InvokePlatformToolResult>`
- **InvokePlatformToolOptions** 建议包含：platformType、agentId 或 agentName、toolId、toolType（如 `"toolSet"` | `"agentToolSet"` | `"workflowToolSet"`）、body/params（与平台约定一致）。
- 各平台适配器（fuyao.ts、agentcenter.ts）内实现：根据平台文档调用对应 HTTP 接口（如 POST xxx/tool/run），带上鉴权与 body，返回执行结果（字符串或结构化）。

这样，**独有工具的执行**只依赖平台提供的「执行接口 + 约定 body」，与 OpenCode 的 tool 形态解耦。

#### 3.2.3 OpenCode 侧：通用调用工具

- **新增一个 OpenCode 工具**（例如 `platform_invoke_tool`），参数建议：
  - `platform_type`: "fuyao" | "agentcenter"
  - `agent_name`: 当前平台 Agent 的 config key（如 `fuyao:CodeHelper`）
  - `tool_id`: 平台返回的 toolId
  - `tool_type`: "toolSet" | "agentToolSet" | "workflowToolSet"（与平台字段一致）
  - `arguments`: 与平台约定一致的 JSON 对象（或字符串由适配器解析）
- **execute**：  
  - 校验当前会话的 agent 是否为该 `agent_name`（或同平台即可，视产品需求而定）；  
  - 调用 `getPlatformAdapter(platform_type).invokeTool({ ... })`；  
  - 将平台返回结果格式化为字符串或约定结构返回给 OpenCode。
- **可见性**：  
  - 仅在**当前 agent 为平台 Agent** 时对该 agent 开放此工具（通过 agent-tool-restrictions 或工具内部校验），避免非平台 Agent 误用。

这样，**所有** toolSet/agentToolSet/workflowToolSet 中的工具都通过**同一套 OpenCode 工具 + 不同参数**完成调用，无需为每个 toolId 注册一个 tool。

#### 3.2.4 让 Agent 知道「有哪些平台工具可用」

- **方式 A（推荐）：只开放列表工具**  
  - 新增工具 `platform_list_tools`（或 `list_platform_tools`）：参数 `platform_type`、`agent_name`；返回当前 agent 的 toolSet、agentToolSet、workflowToolSet 的摘要（如 toolId、描述、toolType）。  
  - Agent 在需要时先调用 `platform_list_tools`，再根据返回的 toolId 与描述调用 `platform_invoke_tool`。  
  - 列表数据来自上文「按 agent 维度的缓存」或按需 getAgentDetail。
- **方式 B：Prompt 注入**  
  - 在构建该平台 Agent 的 system prompt（或注入片段）时，把「当前 agent 的 toolSet/agentToolSet/workflowToolSet」拼成一段说明（如「你可通过 platform_invoke_tool 调用以下工具：…」）。  
  - 需要 config-handler 或 agent 构建逻辑能拿到当前 agent 的这三类集合并写入 prompt；若详情在列表阶段未拉全，需在首次使用该 agent 时拉取详情并缓存。
- **方式 C：A + B**  
  - 列表工具保证运行时总能拿到最新；Prompt 注入减少一次列表调用、提升可读性；可同时支持。

建议先实现 **A**，再视需要加 B。

### 3.3 与现有架构的衔接点

| 环节 | 修改/新增点 |
|------|-------------|
| **types.ts** | PlatformAgentApp 增加 tool_set?、agent_tool_set?、workflow_tool_set?（或与平台命名一致）；新增 InvokePlatformToolOptions、InvokePlatformToolResult。 |
| **config-bridge** | 可选：若需把「可用 platform tool 的摘要」写入 agent 的某扩展字段供 prompt 使用，可在这里带过；否则可不改，仅透传。 |
| **config-handler** | 拉取/合并时若拿到详情（含三类 tool 集），写入「平台 agent → 工具集」缓存，供 platform_list_tools / platform_invoke_tool 使用。 |
| **platforms/fuyao.ts、agentcenter.ts** | getAgentList/getAgentDetail 将平台 mcpToolSet/skillSet/agentSet 映射为现有字段；将 toolSet/agentToolSet/workflowToolSet 映射到新字段；实现 invokeTool 调平台执行接口。 |
| **api.ts 或 platforms/index** | 提供 `invokePlatformTool(platform, options)`，内部调 adapter.invokeTool。 |
| **tools/** | 新增 `platform-invoke-tool`、`platform-list-tools`（或合并为一个工具两种模式），在 index 中注册；agent-tool-restrictions 中仅对平台 agent 开放上述工具。 |

### 3.4 小结

- **常规项**：通过详情 API 映射 mcpToolSet→mcp_definitions、skillSet→skill_definitions/下载、agentSet→subagents，沿用现有 config 合并与运行逻辑即可。
- **独有工具**：  
  - 在类型与详情拉取中增加 toolSet/agentToolSet/workflowToolSet 的存储；  
  - 适配器实现 `invokeTool` 调平台执行接口；  
  - OpenCode 侧提供通用工具 `platform_invoke_tool`（+ 可选 `platform_list_tools` 或 prompt 注入），仅对平台 Agent 开放；  
  - 不要求 OpenCode 支持「按 agent 动态注册 N 个 tool」，即可兼容当前平台独有工具形态的调用。

---

## 四、实施顺序建议

1. **Phase 1（常规项）**  
   - 详情 API 对接：在适配器中解析 mcpToolSet、skillSet、agentSet，映射到现有 PlatformAgentApp 字段及 config-bridge/config-handler 已有合并逻辑；  
   - 如需按 skillSet 自动下载，在拉取详情或合并时调用现有 skill 下载与部署目录逻辑。

2. **Phase 2（独有工具）**  
   - 扩展类型与详情解析（toolSet/agentToolSet/workflowToolSet）；  
   - 实现 adapter.invokeTool 与平台执行接口；  
   - 实现 `platform_invoke_tool`（及可选 `platform_list_tools`）；  
   - 配置 agent-tool-restrictions，仅对平台 agent 开放；  
   - 按需增加「平台 agent → 工具集」缓存与 prompt 注入。

3. **Phase 3（优化）**  
   - 错误码与重试、鉴权失败提示、平台限流等；  
   - 若平台支持，可做 tool 结果缓存或结果结构化（如 JSON schema）以便 Agent 更好解析。

上述方案在不大改 OpenCode 插件模型的前提下，完成对「平台 Agent 详情常规项」的配置转化，并兼容「平台独有工具形态」的识别与调用。
