# fuyao-opencode-omo Mock 功能清单与替换说明

本文档结合《基于OMO的Agent平台对接插件-设计文档》与《fuyao-opencode-omo能力总结与终端验证》分析当前工程，**逐项列出已 Mock 的功能与细节**（API 及调用方式、数据与结构、功能逻辑），并标注**替换为真实 API/数据/功能逻辑时的具体位置与替换要点**。

---

## 一、Mock 功能总览

| 类别 | Mock 项 | 涉及文件 | 替换后影响范围 |
|------|---------|----------|----------------|
| 平台 Agent 列表 | getAgentList 返回本地 mock 数组 | platforms/fuyao.ts、platforms/agentcenter.ts、mock-data.ts | config-handler 合并、version-cache 写入、Agent 列表展示 |
| 平台 Agent 详情 | getAgentDetail 从 mock 列表按 id/name+version 查找 | platforms/fuyao.ts、platforms/agentcenter.ts | getPlatformAgentDetail、发布时 base 拉取 |
| 平台 Agent 发布 | publishAgent 直接 resolve 版本无 HTTP | platforms/fuyao.ts、platforms/agentcenter.ts | platform_agent_publish tool、version-cache 更新 |
| Skill 市场列表 | getSkillMarketList 使用 mock 数组 | skill-market/api.ts、mock-data.ts | 列表/分页/query、skill_inject_to_agent 可选 skill_id |
| Skill 市场下载 | downloadSkillToMarket 仅写占位 SKILL.md，不拉包 | skill-market/api.ts | skill_inject_to_agent、市场 skill 本地可用 |
| 平台独有工具执行 | adapter.invokeTool 直接返回 success+output 文案，无 HTTP 调平台 | platforms/fuyao.ts、platforms/agentcenter.ts | platform_invoke_tool 的 execute 结果 |

以下各节展开上述每类的：**API 与调用方式**、**数据与结构**、**功能逻辑**，以及**替换位置与替换细节**。

---

## 二、平台 Agent 相关 Mock

### 2.1 平台 Agent 列表（getAgentList）

#### API 与调用方式

- **入口**：`getPlatformAgentList(platformType, options?)`  
  - 文件：`src/features/platform-agent/api.ts`  
  - 实现：`getPlatformAdapter(platformType).getAgentList(options)`，无 HTTP，直接走适配器。
- **适配器**：
  - `src/features/platform-agent/platforms/fuyao.ts`：`fuyaoAdapter.getAgentList(_options)` 返回 `[...MOCK_FUYAO_AGENTS]`。
  - `src/features/platform-agent/platforms/agentcenter.ts`：`agentcenterAdapter.getAgentList(_options)` 返回 `[...MOCK_AGENTCENTER_AGENTS]`。
- **调用链**：
  - config 合并：`config-handler.ts` 中 `loadPlatformAgents()` → `getPlatformAgentList(platform)` → 各 adapter.getAgentList()。
  - 同步/发布：`platform-agent-sync/tools.ts`、`platform-agent-publish/tools.ts` 中调用 `getPlatformAgentList(platform)` 获取列表做版本比对或取 base。

#### 数据与结构

- **Mock 数据定义**：`src/features/platform-agent/mock-data.ts`
  - **扶摇**：`MOCK_FUYAO_AGENTS: PlatformAgentApp[]`  
    含主 Agent：CodeHelper、DocAgent；子 Agent：CodeReviewer、TestWriter、RefactorHelper、DocReviewer。每项含 id、name、version、prompt、model、description、subagents、skills、mcps、skill_definitions、mcp_definitions、mode 等。
  - **AgentCenter**：`MOCK_AGENTCENTER_AGENTS: PlatformAgentApp[]`  
    含主 Agent：Reviewer、QAAgent；子 Agent：StyleChecker、SecurityScan。
- **系统提示词 Mock**（同文件）：
  - 扶摇：`FUYAO_MOCK_SYSTEM_PROMPT`，各 app 的 `prompt` 为「基础句 + \nFocus: xxx」。
  - AgentCenter：`AGENTCENTER_MOCK_SYSTEM_PROMPT`，同上。
- **平台 Skill/MCP 定义 Mock**（同文件）：
  - `MOCK_PLATFORM_SKILL`（platform-code-review）、`MOCK_PLATFORM_MCP`（url: https://mock-platform-mcp.example.com/mcp）被写入 CodeHelper 的 skill_definitions、mcp_definitions。

#### 功能逻辑（当前 Mock 行为）

- 不区分 `options`（limit/offset 未使用），直接返回完整 mock 数组副本。
- 无网络、无鉴权、无分页；列表固定，仅随 mock-data 变更。

#### 替换为真实 API 时的位置与要点

| 位置 | 文件 | 行/函数 | 替换要点 |
|------|------|---------|----------|
| 扶摇列表 | `src/features/platform-agent/platforms/fuyao.ts` | `getAgentList` 整个实现 | 改为 GET 平台列表 API（路径、Header、鉴权在适配器内解析）；将响应映射为 `PlatformAgentApp[]`（id、name、version、prompt、model、permission、skills、mcps、subagents、skill_definitions、mcp_definitions 等）；若 API 分页，在此做循环或传 limit/offset。 |
| AgentCenter 列表 | `src/features/platform-agent/platforms/agentcenter.ts` | `getAgentList` 整个实现 | 同上，按 AgentCenter 实际列表 API 做请求与字段映射。 |
| Mock 数据是否保留 | `src/features/platform-agent/mock-data.ts` | 整个文件 | 真实对接后可从适配器移除对 MOCK_FUYAO_AGENTS / MOCK_AGENTCENTER_AGENTS 的引用；若需保留单测或离线演示，可保留 mock-data，仅在适配器内通过开关或环境切真实/ mock。 |
| 设计文档约定 | 附录 7 | - | 列表 API 返回字段需含：id、name、version、prompt、model、permission、mode、skills、mcps、subagents、updatedAt 等，以便与 `PlatformAgentApp` 一致。 |

---

### 2.2 平台 Agent 详情（getAgentDetail）

#### API 与调用方式

- **入口**：`getPlatformAgentDetail(platformType, options)`  
  - 文件：`src/features/platform-agent/api.ts`  
  - 实现：若适配器有 `getAgentDetail` 则调用；否则用 `getAgentList({})` 再按 id 或 name+version 在列表中查找。
- **适配器**：
  - `fuyao.ts`：`getAgentDetail(options)` 在 `MOCK_FUYAO_AGENTS` 中按 `options.id` 或 `options.name` + `options.version` 查找并返回单条或 null。
  - `agentcenter.ts`：同上，在 `MOCK_AGENTCENTER_AGENTS` 中查找。

#### 数据与结构

- 入参：`GetAgentDetailOptions`（id?: string；name?: string；version?: string）。
- 返回：`Promise<PlatformAgentApp | null>`，结构与 mock-data 中单条一致。

#### 功能逻辑（当前 Mock 行为）

- 仅内存查找，无单独「详情 API」请求；若平台有独立详情接口，当前未使用。

#### 替换为真实 API 时的位置与要点

| 位置 | 文件 | 行/函数 | 替换要点 |
|------|------|---------|----------|
| 扶摇详情 | `src/features/platform-agent/platforms/fuyao.ts` | `getAgentDetail` 整个实现 | 改为 GET 平台详情 API（按 id 或 name+version）；响应映射为 `PlatformAgentApp`；鉴权在适配器内处理。 |
| AgentCenter 详情 | `src/features/platform-agent/platforms/agentcenter.ts` | `getAgentDetail` 整个实现 | 同上，按 AgentCenter 详情 API 实现。 |

---

### 2.3 平台 Agent 发布（publishAgent）

#### API 与调用方式

- **入口**：`publishPlatformAgent(platformType, app)`  
  - 文件：`src/features/platform-agent/api.ts`  
  - 实现：若适配器有 `publishAgent` 则调用；否则直接 `Promise.resolve({ version: app.version ?? "1.0.0" })`（即 api 层 mock 成功）。
- **适配器**：
  - `fuyao.ts`：`publishAgent(app)` 直接 `return { version: app.version ?? "1.0.0" }`，无请求。
  - `agentcenter.ts`：同上。

#### 数据与结构

- 入参：`PlatformAgentApp`（由 `openCodeAgentToPlatformApp` 从 config 转出，含 name、prompt、model、permission、skills、mcps、subagents 等）。
- 返回：`PublishResult { version: string }`。
- **调用链**：`platform-agent-publish/tools.ts` 的 execute 中：`getPlatformAgentList` 取 base → 与 userOverride 合并为 entry → `openCodeAgentToPlatformApp(entry, platform)` → `publishPlatformAgent(platform, app)` → 成功后 `readVersionCache` / `writeVersionCache` 更新本地缓存。

#### 功能逻辑（当前 Mock 行为）

- 不发送 POST/PUT，仅返回传入或默认 version；version-cache 的写入逻辑已实现，会按该 version 更新。

#### 替换为真实 API 时的位置与要点

| 位置 | 文件 | 行/函数 | 替换要点 |
|------|------|---------|----------|
| 扶摇发布 | `src/features/platform-agent/platforms/fuyao.ts` | `publishAgent` 整个实现 | 改为 POST/PUT 平台发布 API；body 含 name、prompt、model、permission、skills、mcps、subagents 等（与附录 7 一致）；从响应中解析 version，返回 `{ version }`；鉴权在适配器内。 |
| AgentCenter 发布 | `src/features/platform-agent/platforms/agentcenter.ts` | `publishAgent` 整个实现 | 同上。 |
| 失败与缓存 | 同上 | - | 发布失败时不要写 version-cache（当前 tool 在 try 内写缓存，若 adapter 抛错则不会执行到写缓存，保持即可）。 |

---

### 2.4 平台独有工具执行（invokeTool）

#### API 与调用方式

- **入口**：`invokePlatformTool(platformType, options)`  
  - 文件：`src/features/platform-agent/api.ts`  
  - 实现：`getPlatformAdapter(platformType).invokeTool(options)`；若适配器无 invokeTool 则返回 `{ success: false, error: "Platform does not support tool invocation" }`。
- **适配器**：`platforms/fuyao.ts`、`platforms/agentcenter.ts` 的 `invokeTool(options)` 直接 resolve `{ success: true, output: "[Fuyao/AgentCenter mock] Invoked tool ..." }`，无 HTTP 请求。

#### 数据与结构

- 入参：`InvokePlatformToolOptions`（agentName、toolId、toolType、arguments?）。
- 返回：`InvokePlatformToolResult`（success、output?、error?）。
- **调用链**：platform_invoke_tool 的 execute → 校验当前 agent 与 agent_name 一致（平台 agent 时）→ invokePlatformTool(platform, options) → adapter.invokeTool(options)。

#### 功能逻辑（当前 Mock 行为）

- 不请求平台「工具执行」接口，仅返回固定格式文案；tool_set/agent_tool_set/workflow_tool_set 来自 mock-data，config-handler 拉取后写入 platform-tool-registry 供 platform_list_tools 使用。

#### 替换为真实 API 时的位置与要点

| 位置 | 文件 | 行/函数 | 替换要点 |
|------|------|---------|----------|
| 扶摇工具执行 | `src/features/platform-agent/platforms/fuyao.ts` | `invokeTool` 整个实现 | 改为调用平台约定的工具执行 API（如 POST xxx/tool/run）；body 含 toolId、toolType、arguments；鉴权在适配器内；解析响应为 InvokePlatformToolResult。 |
| AgentCenter 工具执行 | `src/features/platform-agent/platforms/agentcenter.ts` | `invokeTool` 整个实现 | 同上，按 AgentCenter 执行接口与 body 约定实现。 |

---

## 三、Skill 市场相关 Mock

### 3.1 Skill 市场列表（getSkillMarketList / getSkillMarketListAll）

#### API 与调用方式

- **入口**：
  - `getSkillMarketList(options?)`：分页列表，返回 `SkillMarketListResult`（items、total、page、pageSize、totalPages）。
  - `getSkillMarketListAll(options?)`：不分页，返回 `SkillMarketItem[]`。
- **文件**：`src/features/skill-market/api.ts`  
  - 内部调用 `getSkillMarketListFromMock(options)` 得到全量，再在内存中分页或过滤；未调用任何远程接口。

#### 数据与结构

- **Mock 数据**：`src/features/skill-market/mock-data.ts`  
  - `MOCK_SKILL_MARKET_ITEMS: SkillMarketItem[]`  
    三条：id 分别为 market-code-review、market-doc-helper、market-test-gen；含 name、version、description、platform。
- **SkillMarketItem**（types）：id、name、version、description、downloadUrl?、platform?、license?、compatibility?。
- **query 过滤**：在 `getSkillMarketListFromMock` 内对 name/description 做小写 includes 过滤，仅本地 mock 过滤。

#### 功能逻辑（当前 Mock 行为）

- 分页在内存中对 mock 数组 slice；query 仅影响 mock 过滤；无网络、无鉴权。

#### 替换为真实 API 时的位置与要点

| 位置 | 文件 | 行/函数 | 替换要点 |
|------|------|---------|----------|
| 列表数据源 | `src/features/skill-market/api.ts` | `getSkillMarketListFromMock`、`getSkillMarketList` 内调用处（约 32–52 行） | 新增 `getSkillMarketListFromRemote(options)` 或按配置切换；在 `getSkillMarketList` 中改为调用远程列表/搜索 API，返回结构映射为 `SkillMarketItem[]`；保留分页与 query 参数传给后端或在此做兼容。 |
| Mock 数据 | `src/features/skill-market/mock-data.ts` | `MOCK_SKILL_MARKET_ITEMS` | 真实对接后列表不再依赖该常量；可保留供单测或 fallback。 |

---

### 3.2 Skill 市场下载（downloadSkillToMarket）

#### API 与调用方式

- **入口**：`downloadSkillToMarket(skillId: string)`  
  - 文件：`src/features/skill-market/api.ts`  
  - 实现：从 `getSkillMarketListAll()` 取列表（当前为 mock），按 skillId 找到 item；在 `getMarketSkillsDir()/<skillId>/` 下 mkdir，写入一个**占位 SKILL.md**（frontmatter 含 name、description，内容为 name + description），不请求 downloadUrl、不解压任何包。

#### 数据与结构

- **SkillMarketItem.downloadUrl**：类型已存在，mock 数据未填；真实对接时应由列表/详情 API 返回，用于拉包。
- **本地目录**：`getMarketSkillsDir()` = `join(getOpenCodeConfigDir(), "skills", "market")`，单 skill 目录为 `market/<skillId>/`，其下需有 `SKILL.md` 以便 opencode-skill-loader 发现。

#### 功能逻辑（当前 Mock 行为）

- 仅创建目录 + 写占位 SKILL.md；不拉取、不解压；skill name 来自 mock 列表的 item.name。

#### 替换为真实 API 时的位置与要点

| 位置 | 文件 | 行/函数 | 替换要点 |
|------|------|---------|----------|
| 下载实现 | `src/features/skill-market/api.ts` | `downloadSkillToMarket` 整个函数（约 83–104 行） | 使用 `SkillMarketItem.downloadUrl`（或平台包地址）发起 HTTP 拉取；将包解压到 `join(getMarketSkillsDir(), skillId)`；保证目录内存在 `SKILL.md` 且 frontmatter name 与 agent 的 skills 引用一致；若 API 无 downloadUrl 则需先调详情/下载接口拿到 URL 或流。 |
| 列表/详情 | 同上 / 类型 | - | 若下载依赖「详情接口」返回 downloadUrl，需在 skill-market 层增加 getSkillDetail(skillId) 并在 download 前调用（当前无该接口，可新增）。 |

---

## 四、与 Mock 相关的数据与结构汇总

### 4.1 平台 Agent 类型与 mock 一致性

- **PlatformAgentApp**（`src/features/platform-agent/types.ts`）：id、name、version、prompt、model、permission、skills、mcps、subagents、mode、description、skill_definitions、mcp_definitions、tool_set、agent_tool_set、workflow_tool_set、**managers**（JSON 数组，每项为 **PlatformAgentManager**：**userId** 用户工号、**name** 用户中文名）。  
  真实 API 返回的 JSON 需能映射到该结构；config-bridge 与 config-handler 不改，仅适配器做映射。platform-tool-registry 在 config-handler 拉取后按 agent 写入上述三类工具集，供 platform_list_tools / platform_invoke_tool 使用。**managers** 用于发布权限校验：配置项 **platform_agent.publish_identity** 表示当前用户工号，当应用存在非空 managers 时，仅当 publish_identity 与某一项的 **userId** 一致才允许执行 platform_agent_publish。**约束**：当前 **OpenCode 插件 API 不提供已登录用户信息**（PluginInput 无 user/account 等），publish_identity 需用户**手动配置**。**手动配置方法**：在 **`fuyao-opencode.json`** 或 **`fuyao-opencode.jsonc`**（OpenCode 配置目录下或项目 `.opencode/` 下）中设置 **`platform_agent.publish_identity`** 为字符串（用户工号），取值须与平台该应用的 **managers** 中某一项的 **userId** 完全一致（如 `"10001"`）；保存后重启 OpenCode。详细步骤见《fuyao-opencode-omo能力总结与终端验证》「publish_identity 手动配置（发布权限）」。
- **version-cache**：`VersionCacheMap = Record<string, string>`（name → version），按平台存于 `.platform-agent-cache-<platformType>.json`，路径由 `getCacheFilePath(platformType, directory)` 决定；写入由 config-handler 与 publish tool 完成，与 mock/真实无关，无需改。

### 4.2 Skill 市场类型与 mock 一致性

- **SkillMarketItem**（`src/features/skill-market/types.ts`）：id、name、version、description、downloadUrl、platform、license、compatibility。  
  真实列表/详情 API 需返回可映射到该结构的字段，尤其是 **downloadUrl** 供下载使用。

### 4.3 配置与发现（非 Mock，仅说明衔接）

- **platform_agent**：schema 中 enabled、platforms；config-handler 读 `pluginConfig.platform_agent` 决定是否拉取、写 version-cache；无需因真实 API 而改。
- **opencode-skill-loader**：`discoverOpencodeGlobalSkills()` 已扫描 `getMarketSkillsDir()` 下子目录，市场 skill 会进入 config.command；只要下载后目录内有 SKILL.md，无需改 loader。
- **persistAgentSkill**（`src/shared/persist-agent-skill.ts`）：写回 `agents[agentKey].skills`；与市场是否 mock 无关。
- **skill_inject_to_agent**（`src/tools/skill-inject-to-agent/tools.ts`）：调用 `getSkillMarketListAll`、`downloadSkillToMarket`、`persistAgentSkill`；列表/下载改为真实后，tool 入参（skill_id、agent_key）不变，仅数据源变为真实。

---

## 五、替换为真实实现时的检查清单

### 5.1 平台 Agent（扶摇 / AgentCenter）

- [ ] **platforms/fuyao.ts**：getAgentList 改为 GET 列表 API，响应 → `PlatformAgentApp[]`；鉴权/baseUrl 在文件内解析，不暴露到 schema。
- [ ] **platforms/fuyao.ts**：getAgentDetail 改为 GET 详情 API（按 id 或 name+version），响应 → `PlatformAgentApp`。
- [ ] **platforms/fuyao.ts**：publishAgent 改为 POST/PUT 发布 API，body 含 name、prompt、model、skills、mcps、subagents 等，响应解析 version 并返回。
- [ ] **platforms/agentcenter.ts**：同上三项。
- [ ] 确认列表/详情 API 返回 **managers**（JSON 数组，每项含 userId、name）并映射到 PlatformAgentApp.managers（PlatformAgentManager[]），以便发布时做权限校验（publish_identity 与 managers[].userId 比对）。
- [ ] 确认列表/详情/发布 API 的路径、Method、Header、错误码（如 401/403）在适配器内处理，不写脏 version-cache，错误向调用方抛出或返回明确文案。
- [ ] **platforms/fuyao.ts**、**platforms/agentcenter.ts**：invokeTool 改为调用平台「工具执行」API（body 含 toolId、toolType、arguments），返回 InvokePlatformToolResult；鉴权在适配器内。
- [ ] （可选）保留 mock-data.ts 与适配器内「开关」便于单测或离线演示。

### 5.2 Skill 市场

- [ ] **skill-market/api.ts**：getSkillMarketList / getSkillMarketListAll 改为调用真实列表/搜索 API，返回 `SkillMarketItem[]`（或分页结构再映射）。
- [ ] **skill-market/api.ts**：downloadSkillToMarket 使用 item.downloadUrl（或详情接口提供的地址）拉取并解压到 `getMarketSkillsDir()/<skillId>/`，并保证 SKILL.md 存在且 name 正确。
- [ ] 若需详情接口：在 api.ts 或适配层新增 getSkillDetail(skillId)，供 download 或 UI 使用。
- [ ] 类型 SkillMarketItem 已含 downloadUrl；确保真实 API 返回该字段或可推导。

### 5.3 无需改动的部分

- config-handler 的 loadPlatformAgents、合并顺序、writeVersionCache。
- platform_agent_publish / platform_agent_sync 的 tool 逻辑与 command 注册。
- index.ts 中 message.updated 的版本校验与 showToast、防抖 Map。
- version-cache 的读/写、getCacheFilePath。
- config-bridge 的 platformAppToOpenCodeAgent、openCodeAgentToPlatformApp、platformAppsToAgentRecord。
- persistAgentSkill、skill_inject_to_agent、opencode-skill-loader 对 market 目录的扫描。
- platform_list_tools、platform_invoke_tool、platform-tool-registry、config-handler 内 setPlatformToolSets、agent-tool-restrictions 对平台工具的限定。
- **platform_agent.publish_identity** 与 **managers** 发布权限校验逻辑（platform-agent-publish/tools.ts）；schema 中 platform_agent 已含 publish_identity。
- schema 中 platform_agent、default_agent、agents 动态 key、AgentOverrideConfigSchema 的 subagents/mcps。

---

## 六、文档与设计引用

- **设计文档**：`docs/基于OMO的Agent平台对接插件-设计文档.md`  
  - 第 11.5 节「Mock 能力与后期改造要点」、附录 7「平台 API 约定」、3.10「Skill 市场对接」。
- **能力与验证**：`docs/fuyao-opencode-omo能力总结与终端验证.md`  
  - 平台列表/详情/发布与 Skill 市场列表/下载为 Mock；终端验证方式在对接真实后端后仍适用。

上述清单覆盖当前工程中**所有已 Mock 的功能与细节**，以及**替换为真实 API、数据与功能逻辑时的具体位置与要点**，便于逐项改造与回归验证。
