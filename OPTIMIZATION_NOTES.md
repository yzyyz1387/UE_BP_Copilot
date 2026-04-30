# 优化说明

本次优化内容：

1. 重构为更紧凑的后台管理式界面，参考 nonebot_plugin_admin/admin-web 的顶部栏 + 左侧可折叠导航 + 主内容区结构。
2. 新增左侧“蓝图库”树状导航，支持按用户 / 文件夹 / 蓝图组织本地文件，并提供新建、复制、删除、切换。
3. 实现蓝图、本地项目库、接口配置、画布位置的 localStorage 持久化。
4. 移除 React Flow 默认无效交互锁按钮，新增真正生效的画布锁定按钮：锁定后禁止拖动节点、缩放、选择和拖动画布。
5. 节点颜色、Pin 颜色、连线颜色改为更接近 UE5 Blueprint 的类型配色；MiniMap 也同步节点颜色。
6. 压缩圆角、边框、内外边距和字体大小，减少装饰性卡片留白，让同屏展示内容更多。
7. 将可见英文品牌文案改为中文：页面标题、顶部标题、README、提示词区域等。
8. 优化系统提示词和外部提示词模板，要求模型输出 UE5 常见 category、nodeType 和 Pin dataType，便于前端按 UE5 风格渲染。
9. 新增 AI 工作区操作协议 `BlueprintWorkspaceResponse`：模型可以返回 `replace_current_blueprint`、`create_blueprint`、`update_blueprint`，前端会识别并自动覆盖当前蓝图、创建新蓝图或更新已有蓝图。
10. 导入区兼容新版工作区操作 JSON 和旧版单蓝图 JSON；旧版单蓝图会自动包装为覆盖当前蓝图操作。
11. 生成提示词会把当前蓝图库摘要传给模型，便于模型判断应该更新已有蓝图还是创建到指定用户/文件夹。

验证情况：

- 已使用 TypeScript `transpileModule` 对 19 个 TS/TSX 文件做语法检查。
- 当前沙盒环境无法完成 `npm ci` / `npm run build`，因为项目依赖没有随压缩包提供且在线安装命令超时；请在本地有网络环境下执行 `npm install && npm run build` 做最终构建验证。

## 本轮新增：接口连接三模式

12. 新增“连接方式”配置，和原来的“接口类型”拆开：
    - 浏览器直连：前端直接请求第三方模型接口，Key 不经过本站服务器，但需要服务商支持 CORS。
    - 云端中转：前端请求 `/api/chat-proxy`，Vercel Serverless 使用用户本次提交的 baseUrl / Key 转发到模型接口，用于解决 CORS。
    - 本地代理：前端请求用户电脑上的 `http://127.0.0.1:8787/proxy/openai`，Key 不经过本站服务器。
13. 新增 `api/chat-proxy.js`，只允许转发 `chat/completions` 和 `responses`，云端模式只允许 `https://` 模型接口，并拒绝 localhost / 内网地址，降低开放代理风险。
14. 新增 `local-proxy/` 本地代理项目，纯 Node.js 20，无第三方依赖；默认只监听 `127.0.0.1:8787`，并限制允许调用的网页 Origin。
15. 新增静态下载包 `public/downloads/ue-bp-copilot-local-proxy.zip`，用户在网页选择“本地代理”后可直接下载。
16. 接口设置面板增加三种模式的区别提示和本地代理部署教程。
17. 请求错误提示会根据当前连接方式给出排查建议，尤其是直连模式遇到 CORS 时提示切换到云端中转或本地代理。

## 本轮新增：左侧变量面板

18. 新增左侧下方 UE 风格变量面板，当前蓝图的 `plan.variables` 会按类型颜色显示。
19. 支持用户手动新增、编辑、删除变量，字段包括名称、类型、默认值、实例可编辑、生成时公开和用途说明。
20. 手动变量修改会同步更新当前 `BlueprintPlan`、右侧变量详情 / JSON 和左侧本地蓝图库，刷新后仍会从 localStorage 恢复。
21. 折叠导航栏时保留快速“V”按钮，可展开侧栏并直接打开新增变量表单。


## 本轮新增：蓝图属性页与连续对话

22. `BlueprintPlan` 新增 `properties` 字段，用于保存 UE 蓝图自带属性或组件默认值调整；`variables` 只保留需要用户创建的变量。
23. 左侧变量面板改为“用户变量”，避免把 Actor Tick、Collision Presets、Generate Overlap Events、Replication 等 Details 属性误当成变量。
24. 右侧边栏改为三页：对话、蓝图属性、AI 配置。
25. “蓝图属性”页新增 UE Details 风格属性区，显示属性分类、当前值、默认值、来源和调整原因；同时保留用户变量、备注、搜索提示、清单和 JSON。
26. “对话”页改为主分页，支持连续会话展示；每个本地蓝图可保存自己的会话记录。
27. 发送给 AI 的上下文会保留最近 8 条完整对话，并把更早内容压缩成摘要，避免长对话直接撑爆上下文，同时不丢失前文意图。
28. 系统提示词、兼容提示词和外部提示词模板均已更新，明确要求 AI 把 UE 自带属性写入 `properties`，把用户需要创建的变量写入 `variables`。

## 云端中转排查增强

18. 新增输出格式策略：自动选择、兼容纯 JSON、JSON Object、严格 JSON Schema。自动模式下，官方 OpenAI 才优先使用 JSON Schema，第三方 OpenAI-compatible 默认不发送 `response_format`，避免兼容网关卡住导致后台 token 用量不变。
19. 新增“测试连接”按钮，只发送一个极小的 `OK` 请求，用于判断云端中转是否真正打到模型服务。
20. `api/chat-proxy.js` 增加上游超时保护、空响应识别和上游 `SocketTimeoutException` 识别，错误会明确显示为中转超时、上游网关超时或空响应。
21. `vercel.json` 为 `api/chat-proxy.js` 配置 `maxDuration: 300`；云端中转内部最多等待约 285 秒，避免复杂蓝图请求被 60 秒函数时限过早截断。
22. `chat/completions` 在纯 JSON 兼容模式下支持上游 `stream: true` 收集，降低 LongCat 等兼容网关长时间无输出导致的 SocketTimeoutException 概率。
23. 本地代理同步支持更长请求超时、上游流式收集与上游 timeout/空响应识别；网页下载包已同步更新。
