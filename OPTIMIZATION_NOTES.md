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

验证情况：

- 已使用 TypeScript transpileModule 对关键 TS/TSX 文件做语法检查。
- 已用 PostCSS 解析 `src/styles.css`，CSS 语法通过。
- 当前沙盒环境无法完成 `npm ci` / `npm run build`，因为项目依赖没有随压缩包提供且在线安装命令超时；请在本地有网络环境下执行 `npm install && npm run build` 做最终构建验证。
