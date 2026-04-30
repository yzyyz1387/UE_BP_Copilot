# UE 蓝图 AI 工作台

> 本地优先的 UE5 蓝图可视化原型工具。用自然语言描述逻辑，即可生成节点图、变量建议、搜索提示和执行清单；所有数据默认保存在浏览器本地。

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## 概览

UE 蓝图 AI 工作台可以通过浏览器直连、云端中转或本地代理三种方式连接 OpenAI 兼容接口，生成结构化蓝图方案。左侧是可折叠蓝图库，并在下方提供类似 UE “我的蓝图”里的变量面板，支持按用户和文件夹保存不同蓝图；中间是 UE5 风格节点画布；右侧改为三页：对话页、蓝图属性页和 AI 配置页。对话页用于连续追问；蓝图属性页显示 UE Details 风格的蓝图自带属性、变量详情、提示和清单；AI 配置页放接口设置、JSON 导入和外部提示词。

项目定位是本地优先原型：API 密钥默认不保存，蓝图文件、画布位置和界面状态使用 `localStorage` 保存在当前浏览器。

---

## 功能

- **连续对话式蓝图生成**：右侧对话页保留连续会话，支持结合当前蓝图继续修改；发送给 AI 时会保留最近消息，并把较早内容压缩成上下文摘要。
- **AI 自动创建蓝图**：模型可返回工作区操作，前端自动在“用户 / 文件夹 / 蓝图”树中创建、覆盖或更新蓝图。
- **结构化输出**：通过 JSON Schema 约束输出 `BlueprintWorkspaceResponse`，每个操作都携带完整 `BlueprintPlan`。
- **三种连接方式**：支持浏览器直连、Vercel 云端中转、本地 127.0.0.1 代理，解决不同模型服务的 CORS 与隐私需求。
- **双接口类型**：支持 `POST /responses` 与 `POST /chat/completions`。
- **自动回退**：结构化输出不兼容时，可自动使用纯 JSON 提示词重试。
- **本地蓝图库**：左侧按“用户 / 文件夹 / 蓝图”组织，可新建、复制、删除和切换。
- **UE 风格用户变量面板**：当前蓝图需要用户创建的变量显示在左侧下方，支持手动新增、编辑、删除，并同步写入 `plan.variables`。
- **蓝图自带属性区分**：UE Details 面板里的自带属性或组件默认值调整写入 `plan.properties`，显示在右侧“蓝图属性”页，不再混入用户变量。
- **画布锁定**：自定义锁定按钮会真正禁止拖动、缩放和选择。
- **UE5 风格颜色**：节点类型和 Pin 类型按 UE5 常见分类着色。
- **导入 / 导出**：导入区同时兼容旧版单蓝图 JSON 和新版工作区操作 JSON。

---

## 技术栈

| 层级 | 依赖 |
|---|---|
| UI 框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 蓝图画布 | @xyflow/react |
| 接口请求 | 浏览器直连 / `/api/chat-proxy` 云端中转 / 本地代理 → OpenAI 兼容 REST |
| 本地存储 | `localStorage` |

---

## 启动

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`，在右侧填写接口设置，然后输入蓝图需求。

```bash
npm run build
npm run preview
```

---

## 配置项

| 字段 | 说明 | 示例 |
|---|---|---|
| 连接方式 | 请求第三方模型接口的方式 | 浏览器直连 / 云端中转 / 本地代理 |
| 接口地址 | OpenAI 兼容接口根地址 | `https://api.openai.com/v1` |
| 密钥 | 用户自己的 API Key，默认不保存 | `sk-...` |
| 模型 | 模型名称 | `gpt-4o` |
| 接口类型 | OpenAI-compatible 请求路径 | `chat/completions` / `responses` |
| 本地代理地址 | 本地代理模式使用 | `http://127.0.0.1:8787` |
| 蓝图类型 | UE 类上下文 | `Actor`, `Character`, `Widget` |
| UE 版本 | 目标引擎版本 | `UE 5.3+` |
| 场景上下文 | 可选补充信息 | `Door Actor with BoxCollision` |


---

## 三种连接方式

| 方式 | 请求路径 | 适合场景 | 注意事项 |
|---|---|---|---|
| 浏览器直连 | 浏览器 → 第三方模型接口 | 服务商支持 CORS，且用户希望 Key 不经过本站服务器 | 很多模型服务会因为 CORS 拦截；Key 可在浏览器 DevTools 中被当前使用者看到 |
| 云端中转 | 浏览器 → `/api/chat-proxy` → 第三方模型接口 | 在线演示、普通用户快速测试、第三方接口不支持 CORS | 用户仍使用自己的接口和 Key；本站代码只转发本次请求，不保存 Key 或请求体，但 Key 会经过本站 Serverless |
| 本地代理 | 浏览器 → `http://127.0.0.1:8787/proxy/openai` → 第三方模型接口 | 隐私优先用户，不希望 Key 经过本站服务器 | 需要用户先下载并运行本地代理 |

### 本地代理部署

网页的“本地代理”模式里提供了下载按钮，静态文件位于：

```text
public/downloads/ue-bp-copilot-local-proxy.zip
```

用户下载并解压后运行：

```bash
cd ue-bp-copilot-local-proxy
node server.mjs
```

看到 `UE BP Copilot local proxy running at http://127.0.0.1:8787` 后，回到网页选择“本地代理”，代理地址保持 `http://127.0.0.1:8787`。

### 云端中转接口

Vercel Serverless 入口：

```text
api/chat-proxy.js
```

它只允许转发 `chat/completions` 与 `responses` 两个路径；云端中转只允许 `https://` 模型接口，并拒绝 localhost / 内网地址，避免被当作任意开放代理。中转函数带 55 秒上游超时保护，`vercel.json` 已为 `api/chat-proxy.js` 配置 `maxDuration: 60`。如果上游返回 `SocketTimeoutException` 或空响应，前端会显示更明确的网关/空响应错误，不再误报成单纯“模型返回为空”。

### 输出格式策略与连接测试

AI 配置页新增“输出格式策略”：

| 策略 | 行为 | 建议场景 |
|---|---|---|
| 自动选择 | 官方 OpenAI 优先使用 JSON Schema；第三方 OpenAI-compatible 默认走纯 JSON | 默认推荐 |
| 兼容纯 JSON | 不发送 `response_format` / `json_schema`，只靠提示词要求返回 JSON | LongCat、DeepSeek、其它兼容接口出现超时或后台 token 不变时优先使用 |
| JSON Object | 发送 `response_format: { type: "json_object" }` | 确认服务商支持 json_object 时使用 |
| 严格 JSON Schema | 发送完整结构化 schema | 官方 OpenAI 或确认兼容 schema 的服务 |

如果云端中转长时间无响应，先点“测试连接”。测试连接只会发送一个很小的“只返回 OK”请求；如果测试也不增加模型后台 token 用量，说明请求没有真正进入模型推理，通常是接口地址、模型名、Key、服务商网关或 Vercel 出口网络问题。

---

## AI 返回格式

生成接口现在优先要求模型返回一个工作区操作对象，而不是只返回单个蓝图。前端会读取 `operations` 并执行对应动作。

```jsonc
{
  "responseType": "blueprint_workspace_operation",
  "assistantReply": "已新建毒气弹蓝图，并放入默认用户的投掷物文件夹。",
  "operations": [
    {
      "id": "op_create_gas_grenade",
      "action": "create_blueprint",
      "target": {
        "projectId": "",
        "userName": "默认用户",
        "folderPath": "投掷物",
        "blueprintName": "BP_GasGrenade"
      },
      "selectAfterApply": true,
      "plan": {
        "meta": {
          "title": "BP_GasGrenade",
          "summary": "投掷后落点生成毒气范围，持续伤害区域内角色。",
          "blueprintType": "Actor",
          "ueVersion": "UE 5.3+",
          "targetUser": "Beginner",
          "sceneContext": "Gas grenade projectile"
        },
        "assistantReply": "...",
        "nodes": [],
        "links": [],
        "variables": [],
        "properties": [],
        "messages": [],
        "searchTips": [],
        "checklist": []
      }
    }
  ]
}
```

`action` 支持三种：

| action | 前端行为 |
|---|---|
| `replace_current_blueprint` | 覆盖当前打开的蓝图。`target.projectId` 可写 `active`。 |
| `create_blueprint` | 在 `target.userName / target.folderPath` 下创建新蓝图。文件夹不存在时由左侧树自动显示。 |
| `update_blueprint` | 按 `projectId` 或 `userName + folderPath + blueprintName` 查找已有蓝图并更新；找不到时自动按新建处理。 |

导入区仍兼容旧版单蓝图 JSON，旧格式会被自动包装为 `replace_current_blueprint`。

### 左侧变量面板

当前蓝图的 `plan.variables` 只表示“需要用户创建/维护的蓝图变量”，会在左侧下方以 UE 风格列表展示。点击变量区右上角 `＋` 可以手动添加变量；点击变量行可以编辑名称、类型、默认值、实例可编辑、生成时公开和说明；点击 `×` 删除变量。所有修改都会立即同步到当前蓝图 JSON 和本地蓝图库。

### 右侧蓝图属性页

`plan.properties` 用于描述 UE 蓝图或组件自带属性的调整，例如 `Actor Tick`、`Replicates`、`Auto Receive Input`、`Collision Presets`、`Generate Overlap Events`、`Mobility` 等。它们会显示在右侧“蓝图属性”页的 Details / 默认属性区域，并标记当前值、默认值和是否已调整。这样 AI 可以区分“需要用户新建的变量”和“UE 原本就有的属性/勾选项”。

---

## 单个 BlueprintPlan 结构

每个 `operation.plan` 都必须是完整蓝图方案：

```jsonc
{
  "meta": {
    "title": "Actor 蓝图：按 E 开门",
    "summary": "...",
    "blueprintType": "Actor",
    "ueVersion": "UE 5.3+",
    "targetUser": "Beginner",
    "sceneContext": "..."
  },
  "assistantReply": "...",
  "nodes": [],
  "links": [],
  "variables": [],
  "properties": [],
  "messages": [],
  "searchTips": [],
  "checklist": []
}
```

---

## 目录结构

```
api/
└── chat-proxy.js            # Vercel 云端中转接口
local-proxy/                 # 本地代理源码，会打成 zip 供网页下载
public/
└── downloads/
    └── ue-bp-copilot-local-proxy.zip
src/
├── components/
│   ├── BlueprintCanvas.tsx   # React Flow 画布与锁定逻辑
│   ├── BlueprintNode.tsx     # UE5 风格节点渲染
│   ├── ChatPanel.tsx         # 连续对话页
│   ├── HeaderBar.tsx         # 顶部栏与节点摘要
│   ├── ImportPanel.tsx       # JSON 导入和外部提示词
│   ├── InspectorTabs.tsx     # 蓝图属性、用户变量、提示、清单、JSON
│   ├── ProjectSidebar.tsx    # 左侧本地蓝图库树与变量面板
│   ├── SettingsPanel.tsx     # 接口设置
│   └── Toast.tsx             # 提示消息
├── data/
│   └── demoBlueprint.ts      # 内置示例蓝图
├── lib/
│   ├── blueprintTransform.ts # 规范化模型输出、布局、颜色映射
│   ├── localStorage.ts       # 配置、蓝图库、位置持久化
│   ├── openaiClient.ts       # 接口请求与回退
│   ├── prompt.ts             # 提示词构建
│   └── workspaceResponse.ts  # AI 工作区操作识别与兼容包装
├── App.tsx
├── schema.ts
├── styles.css
└── types.ts
```

---

## 安全说明

项目支持三种连接方式：浏览器直连时 Key 不经过本站服务器，但受 CORS 限制且 Key 会存在于浏览器环境；云端中转用于解决 CORS，本站代码不保存 Key 或请求体，但 Key 会经过 Vercel Serverless；本地代理让 Key 只发到用户自己的 127.0.0.1 代理，更适合隐私敏感场景。

---

## License

MIT
