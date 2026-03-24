# UE Blueprint AI Studio（初版原型）

一个 **本地优先（local-first）** 的 UE5 蓝图可视化网页项目原型：  
左侧渲染 AI 生成的“蓝图节点图”，右侧提供聊天区、变量建议、新手提醒、节点搜索提示、Checklist 和原始 JSON。

> 这个版本是 **纯前端直连 OpenAI / OpenAI 兼容接口** 的原型，不需要你把 API Key 发给自建服务器。  
> 但也正因为它运行在浏览器里，所以更适合 **个人本机使用、内网使用、Demo/原型阶段**，**不建议直接公开部署到公网**。

---

## 这版我补充进去的内容

除了你提出的“左侧蓝图展示 + 右侧聊天与备注”之外，这个初版还补了这些设计点：

1. **结构化输出约束**
   - 用 JSON Schema 限制模型输出，避免只回一段自然语言。
   - 输出内容分成：
     - `meta`：蓝图标题、类型、摘要、UE 版本
     - `assistantReply`：聊天区自然语言回复
     - `nodes` / `links`：可视化蓝图数据
     - `variables`：建议新建或提升的变量
     - `messages`：新手提醒 / 警告 / 备注
     - `searchTips`：某些节点找不到时该怎么加
     - `checklist`：实际进 UE 编辑器后要做的检查项

2. **双 API 模式**
   - `responses`
   - `chat/completions`
   - 一些 OpenAI 兼容端只支持其中一个，所以做了切换。

3. **结构化失败时的兼容回退**
   - 先尝试严格 Schema。
   - 如果兼容端不支持，再自动回退到 “只返回 JSON” 模式。
   - 适合你说的“OpenAI 标准 URL”场景。

4. **右侧附加内容面板**
   - 新手备注
   - 变量建议
   - 节点搜索提示
   - Checklist
   - 原始结构 JSON

5. **基于当前图继续修改**
   - 可以勾选“基于当前图继续修改”。
   - 这样下一轮提问时，AI 会把当前蓝图也一起作为上下文。

6. **本地示例图**
   - 项目自带一个“按 E 开门”的 Actor 蓝图示例，不填 API 也能先看 UI 和数据结构。

7. **导出 / 复制 / 导入**
   - 导出当前蓝图 JSON
   - 复制当前蓝图 JSON
   - 粘贴外部 JSON 并直接导入当前画布

8. **给其他 AI 的一键 Prompt**
   - 内置可复制模板
   - 适合把结构要求发给其他模型后，再把结果贴回本页导入

9. **更省 token 的提示策略**
   - 不再要求 AI 对每个节点逐一解释
   - 默认只保留关键新手提醒与必要的节点注释
   - 压缩对话上下文，减少重复传输

10. **画布交互优化**
   - 鼠标滚轮缩放
   - 拖动画布
   - 点击节点查看详情

---

## 技术选型

- React + TypeScript + Vite
- `@xyflow/react`（React Flow）做蓝图可视化
- 纯浏览器 `fetch` 调 OpenAI / 兼容端 REST API
- 不依赖后端服务

---

## 本地运行

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

---

## 使用方式

### 1）填 API 设置
右侧 **API 设置** 中填写：

- Base URL：例如 `https://api.openai.com/v1`
- API Key：你的 Key
- Model：例如你自己的可用模型名
- API 模式：`responses` 或 `chat/completions`

### 2）填蓝图上下文
右侧 **蓝图上下文** 中可补充：

- Blueprint 类型：Actor / Character / Widget / Level Blueprint...
- UE 版本
- 场景上下文（可选）

### 3）开始描述需求
在聊天框输入例如：

- 做一个按下 E 打开门的 Actor 蓝图
- 做一个角色按 Shift 奔跑的 Character 蓝图
- 做一个 Widget 按钮切换两个面板显示隐藏
- 基于当前图，把开门逻辑改成按一次打开、再按一次关闭

---

## 数据结构说明（核心）

AI 最终要输出一个完整 JSON 对象，核心结构如下：

```json
{
  "meta": {
    "title": "Actor 蓝图：按 E 开门",
    "summary": "一个给新手使用的交互门蓝图",
    "blueprintType": "Actor",
    "ueVersion": "UE 5.3+",
    "targetUser": "Beginner",
    "sceneContext": "Door Actor"
  },
  "assistantReply": "我给你做了一个入门友好的门交互蓝图方案。",
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

```text
ue-blueprint-ai-studio/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ README.md
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ styles.css
   ├─ types.ts
   ├─ schema.ts
   ├─ data/
   │  └─ demoBlueprint.ts
   ├─ lib/
   │  ├─ blueprintTransform.ts
   │  ├─ localStorage.ts
   │  ├─ openaiClient.ts
   │  └─ prompt.ts
   └─ components/
      ├─ BlueprintCanvas.tsx
      ├─ BlueprintNode.tsx
      ├─ ChatPanel.tsx
      ├─ HeaderBar.tsx
      ├─ ImportPanel.tsx
      ├─ InspectorTabs.tsx
      └─ SettingsPanel.tsx
```

---

## 安全说明（一定要看）

这个项目虽然 **不会把 Key 发到你的自建后端**，但 **Key 依然处在浏览器环境里**。  
因此：

- 适合：本机开发、原型、内网、个人使用
- 不适合：公开网页、多人共享公网部署、把永久 Key 明文交给陌生用户输入的 SaaS 页面

如果你下一步要把它做成真正上线产品，建议增加：

1. 服务端中转层
2. 临时令牌 / 会话签名
3. 用量限制与审计
4. 用户项目保存
5. Blueprint 节点库校验
6. UE 节点模板 / 预制流程库
7. 导出为 UE 可导入格式（后续再做）

---

## 已知限制

1. 当前渲染的是 **蓝图可视化原型图**，不是直接导入 UE 的 `.uasset`。
2. AI 生成的节点名会尽量贴近 UE5，但仍建议你在真实项目里手动核对。
3. 不同兼容服务商对 Structured Outputs 的支持程度不一样，所以保留了兼容回退逻辑。
4. 如果浏览器环境或你的网络策略限制了跨域请求，你可能还需要后续加一个本地代理版。

---

## 后续建议路线

### P1
- 节点库白名单
- 节点搜索自动纠错
- 更像 UE 的节点样式
- 画布保存 / 导入工程草稿

### P2
- Blueprint 逻辑校验器
- 自动补全常见变量
- 节点连接合法性检查
- 生成“在 UE 中如何手动搭建”的步骤文档

### P3
- 导出成 UE 插件侧可消费格式
- 与真实 UE Editor 插件联动
- 从自然语言直接驱动蓝图增量修改

---

## 适合的下一步

如果你准备继续做第二版，建议直接在这个原型上加两件事：

1. **节点词典 / 白名单**
   - 把 UE 常见节点做成可检索字典。
   - 让 AI 只能从字典中优先选择，减少幻觉节点。

2. **UE 插件桥接**
   - 网页端负责对话与结构化规划
   - UE 插件负责把 JSON 映射成真正蓝图操作

这样项目会非常顺。
