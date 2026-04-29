# UE BP Copilot 本地代理

这个代理用于解决第三方模型接口不支持浏览器 CORS 的问题。它只运行在你的电脑上，默认监听：

```text
http://127.0.0.1:8787
```

UE BP Copilot 网页会把你填写的模型接口地址、模型名、API Key 和本次请求发送到本机代理，再由本机代理请求模型接口。代理不会保存 API Key，也不会保存请求内容。

## 使用步骤

1. 安装 Node.js 20 或更高版本。
2. 解压本目录。
3. 在目录中运行：

```bash
node server.mjs
```

也可以运行：

```bash
npm start
```

Windows 用户也可以双击 `start.cmd`。

4. 打开 UE BP Copilot 网页，连接方式选择“本地代理”。
5. 本地代理地址保持：

```text
http://127.0.0.1:8787
```

6. 填写你自己的模型接口地址、模型名和 API Key。

## 可选环境变量

```bash
PORT=8787
ALLOWED_ORIGINS=https://ue-bp-copilot.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

`ALLOWED_ORIGINS` 用来限制哪些网页可以调用这个本地代理。默认只允许 UE BP Copilot 演示站和本地开发地址。

## 安全说明

- 代理只允许转发 `/chat/completions` 和 `/responses` 两个 OpenAI-compatible 路径。
- 代理不会写入任何日志文件。
- 终端只会显示启动信息和必要错误，不会打印 Authorization 请求头。
- 如果你关闭终端窗口，代理就会停止。
