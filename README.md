# 澄言 · Chengyan

一个受 DeepSeek 启发的中文 AI 聊天界面，使用 React、TypeScript、Vite 和 Express。浅色蓝紫配色，也支持深色主题与手机布局。

## 本地启动

需要 Node.js 22.12+（推荐 Node.js 22 LTS）。

```bash
npm install
npm run dev
```

打开 <http://127.0.0.1:5178>。前端运行在 5178，API 转发服务运行在 3001。两者均默认只监听本机。退出时使用 `Ctrl+C`。

## 连接模型

1. 点击左下角「设置」或右上角「连接模型」。
2. 选择服务商，填写自己的 API Key。预设包括 DeepSeek、通义千问、OpenAI；也可填写其他兼容接口。
3. 确认 API 地址和模型名称，点击「保存设置」。模型是否可用取决于你的服务商、账户权限和额度；预设名称可以修改。
4. 输入问题并发送。后续消息会携带当前对话上下文。

| 服务              | API 地址示例                                        | 模型名称示例         |
| ----------------- | --------------------------------------------------- | -------------------- |
| DeepSeek          | `https://api.deepseek.com`                          | `deepseek-chat`      |
| 通义千问          | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus`          |
| OpenAI            | `https://api.openai.com/v1`                         | `gpt-4.1-mini`       |
| Ollama 等本地服务 | `http://127.0.0.1:11434/v1`                         | 已安装的实际模型名称 |

API 地址可以是 Base URL，也可以包含完整的 `/chat/completions` 路径。接口需要支持 OpenAI Chat Completions 格式及 SSE 流式响应。自定义服务允许留空密钥，适用于无需鉴权的本地模型。

「深度思考」会切换到设置中填写的推理模型，并显示服务返回的 `reasoning_content`。具体推理能力及参数支持由服务商决定。本项目未加入联网搜索或图片识别。

没有 API Key 时，在设置中开启「先体验一下」即可体验本地预设流式回复。演示模式会明确标识，**不会调用模型，也不提供真实的针对性回答**。

## 已实现功能

- 流式问答、停止生成、重新生成、系统提示词和创造性参数。
- Markdown、代码块复制、列表、引用及表格展示。
- 历史对话自动保存，按日期分组，支持全文搜索、置顶、重命名和删除。
- JSON 导入与全部导出、单个对话导出为 Markdown，备份不包含 API 配置或密钥。
- 文本附件：TXT、Markdown、CSV、JSON 及常见代码文件；每条最多 3 个、每个 100 KB。附件文本会随对话发送到所配置的模型服务。
- 浅色、深色、跟随系统三种主题；移动端抽屉侧栏。
- `Enter` 发送、`Shift + Enter` 换行、`Ctrl/Cmd + K` 搜索。
- 网络、鉴权、限流、空回复、流中断等错误提示；刷新前未结束的回答会标记为已停止。

## 数据与运行方式

对话存储在当前浏览器当前站点的 `localStorage` 中；没有账号系统或跨设备同步。不同浏览器、域名和端口的数据互相独立，清除站点数据会丢失历史，请使用数据管理中的导出功能备份。

API Key 默认存放于当前标签页的 `sessionStorage`，关闭标签页后结束会话。只有主动勾选「在此浏览器记住密钥」才会明文写入 `localStorage`。转发服务不把对话或密钥写入磁盘，也不主动打印它们。请求携带的密钥和对话仅转发至用户配置的模型地址。

此版本定位为本机单人使用。若要部署到公网，应先在反向代理或应用层加入身份验证、限流及允许访问的上游地址列表；当前转发接口允许自定义上游，不能直接作为公共匿名服务发布。

## 构建与生产运行

```bash
npm run build
npm start
```

生产页面与 API 均从 <http://127.0.0.1:3001> 提供，需保留 `dist`、`server`、`package.json` 和运行依赖。`PORT`、`HOST` 环境变量可调整服务监听位置；默认 `HOST=127.0.0.1`。

开发前端端口可在 `vite.config.ts` 修改，同时更新 `server/app.mjs` 的开发来源白名单。仅部署 `dist` 到静态托管不能使用 API 转发，需同时运行 Node 服务。

## Docker / GHCR

仓库：<https://github.com/Ghost-soul/qwen>。镜像：`ghcr.io/ghost-soul/qwen`，当前构建平台为 `linux/amd64`。

拉取并运行已发布镜像：

```bash
docker pull ghcr.io/ghost-soul/qwen:latest
docker run -d --name chengyan --restart unless-stopped \
  -p 127.0.0.1:8080:3001 \
  ghcr.io/ghost-soul/qwen:latest
```

访问 <http://127.0.0.1:8080>。若镜像包为私有，先用具有 `read:packages` 权限的 GitHub 令牌通过 `docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin` 登录；不要将令牌写入源码或镜像。镜像的可见性以 GitHub Packages 页面设置为准。

仓库自带 Compose，默认只将端口绑定到本机：

```bash
docker compose pull
docker compose up -d --no-build
```

或者在本地构建并启动：

```bash
docker compose up -d --build
```

使用 `QWEN_PORT` 环境变量可替换宿主机的 8080 端口。容器内部监听 `0.0.0.0:3001`，以非 root 用户运行；Compose 启用了只读文件系统与健康检查。对话仍保存在浏览器，容器不需要数据卷，也不会包含 API 密钥。容器内访问宿主机 Ollama 时，API 地址应使用 `http://host.docker.internal:11434/v1`，不能使用容器自己的 `127.0.0.1`。

GitHub Actions 在推送 `main` 后自动运行测试、构建镜像并验证容器，再使用仓库自带的 `GITHUB_TOKEN` 上传到 GHCR，无需在仓库添加个人令牌。主分支发布 `latest` 和 `sha-完整提交SHA`；推送 `v1.2.3` 这样的版本标签时发布 `1.2.3` 和提交标签。PR 只验证，不发布。

可独立复查运行中的容器：

```bash
node scripts/container-smoke.mjs http://127.0.0.1:8080
```

## 验证

```bash
npm test
npm run build
```

自动化测试使用本地 HTTP 模型替身，覆盖真实请求转发、SSE 中文分片、推理内容、上游错误、取消传播、导入校验和密钥存储偏好。它们不调用付费模型，不代表任何真实服务商账户的鉴权或额度已验证。

```text
src/App.tsx                 聊天、侧栏与历史管理
src/components/             设置面板、Markdown、通用弹窗
src/lib/chat.ts             SSE 解析与请求、明确标注的演示回复
src/lib/storage.ts          本地存储、导入校验及导出
src/styles.css              主题、布局和响应式样式
server/app.mjs              可测试的 Express 转发应用
server/index.mjs            开发与生产服务入口
tests/                     自动化验证
```
