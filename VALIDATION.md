# 验证记录

验证日期：2026-09-27。

- `npm test`：3 个测试文件、17 项测试全部通过。
- `npm run build`：TypeScript 检查及 Vite 生产构建通过。
- `npm audit`：依赖审计为 0 个已知漏洞。
- `npm install --package-lock-only --ignore-scripts`：标准 npm 依赖解析及锁文件校验通过。
- 生产服务冒烟检查：从构建产物返回首页、包含构建资源引用，`/api/health` 返回成功。

浏览器中实际验证了发送演示消息、流式显示、停止、重新生成、代码复制、Markdown 表格、重命名、置顶、全文搜索以及刷新后历史保留。检查了默认桌面布局和 390 × 844 手机布局、移动侧栏、浅色及深色主题；检查时浏览器无 warning/error 日志。

API 自动化使用本机 HTTP 模型替身，覆盖转发请求、鉴权头、上下文、SSE、上游鉴权失败、协议错误和用户取消后的上游连接释放。未提供真实 API Key，因此没有调用或验证实际服务商的账户、额度与真实模型回复。

预览中的两段对话为本地演示数据。真实使用时在设置中关闭演示并填写自己的 API 配置。

## Docker 发布前验证

- 本地 Linux/amd64 多阶段镜像构建成功；容器构建阶段重新运行 17 项测试及生产构建，均通过。
- 使用非 root 用户、只读根文件系统、移除 Linux capabilities 的运行配置，容器成功启动。
- `scripts/container-smoke.mjs` 验证了运行中的容器首页、实际 JS/CSS 资源、健康接口和 API 请求校验，全部通过。
- `docker compose config --quiet` 通过，源码凭据模式扫描未发现匹配项。
- GitHub Actions 会对每个待发布提交执行相同测试与容器验证，推送后检查 GHCR 远端镜像清单；实际发布结果以仓库 Actions 运行记录为准。
