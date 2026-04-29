# UE 蓝图 AI 工作台

> 本地优先的 UE5 蓝图可视化原型工具。用自然语言描述逻辑，即可生成节点图、变量建议、搜索提示和执行清单；所有数据默认保存在浏览器本地。

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## 概览

UE 蓝图 AI 工作台可以在浏览器中直连 OpenAI 兼容接口，生成结构化蓝图方案。左侧是可折叠蓝图库，支持按用户和文件夹保存不同蓝图；中间是 UE5 风格节点画布；右侧是接口设置、导入、变量、提示、清单和聊天输入区。

项目定位是本地优先原型：API 密钥默认不保存，蓝图文件、画布位置和界面状态使用 `localStorage` 保存在当前浏览器。

---

## 功能

- **对话式蓝图生成**：支持结合当前蓝图继续修改。
- **结构化输出**：通过 JSON Schema 约束输出 nodes、links、variables、messages、searchTips、checklist。
- **双接口模式**：支持 `POST /responses` 与 `POST /chat/completions`。
- **自动回退**：结构化输出不兼容时，可自动使用纯 JSON 提示词重试。
- **本地蓝图库**：左侧按“用户 / 文件夹 / 蓝图”组织，可新建、复制、删除和切换。
- **画布锁定**：自定义锁定按钮会真正禁止拖动、缩放和选择。
- **UE5 风格颜色**：节点类型和 Pin 类型按 UE5 常见分类着色。
- **导入 / 导出**：支持粘贴外部 JSON、导出当前 JSON、复制外部提示词模板。

---

## 技术栈

| 层级 | 依赖 |
|---|---|
| UI 框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 蓝图画布 | @xyflow/react |
| 接口请求 | 浏览器 `fetch` → OpenAI 兼容 REST |
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
| 接口地址 | OpenAI 兼容接口根地址 | `https://api.openai.com/v1` |
| 密钥 | API 密钥，默认不保存 | `sk-...` |
| 模型 | 模型名称 | `gpt-4o` |
| 接口模式 | 接口类型 | `chat/completions` |
| 蓝图类型 | UE 类上下文 | `Actor`, `Character`, `Widget` |
| UE 版本 | 目标引擎版本 | `UE 5.3+` |
| 场景上下文 | 可选补充信息 | `Door Actor with BoxCollision` |

---

## 输出结构

每次生成都会产出一个 JSON 对象：

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
  "messages": [],
  "searchTips": [],
  "checklist": []
}
```

---

## 目录结构

```
src/
├── components/
│   ├── BlueprintCanvas.tsx   # React Flow 画布与锁定逻辑
│   ├── BlueprintNode.tsx     # UE5 风格节点渲染
│   ├── ChatPanel.tsx         # 对话输入区
│   ├── HeaderBar.tsx         # 顶部栏与节点摘要
│   ├── ImportPanel.tsx       # JSON 导入和外部提示词
│   ├── InspectorTabs.tsx     # 备注、变量、提示、清单、JSON
│   ├── ProjectSidebar.tsx    # 左侧本地蓝图库树
│   ├── SettingsPanel.tsx     # 接口设置
│   └── Toast.tsx             # 提示消息
├── data/
│   └── demoBlueprint.ts      # 内置示例蓝图
├── lib/
│   ├── blueprintTransform.ts # 规范化模型输出、布局、颜色映射
│   ├── localStorage.ts       # 配置、蓝图库、位置持久化
│   ├── openaiClient.ts       # 接口请求与回退
│   └── prompt.ts             # 提示词构建
├── App.tsx
├── schema.ts
├── styles.css
└── types.ts
```

---

## 安全说明

项目直接从浏览器请求接口。密钥不会发送到中间服务器，但仍存在于浏览器环境中。建议用于本地开发、内部工具和演示；公开部署时建议增加服务端代理、短期令牌和限流。

---

## License

MIT
