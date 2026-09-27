import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createApp({ production = false } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.headers.origin;
    const allowed = new Set([
      `http://${req.headers.host}`,
      `https://${req.headers.host}`,
      "http://127.0.0.1:5178",
      "http://localhost:5178",
    ]);
    if (origin && !allowed.has(origin))
      return res
        .status(403)
        .json({ error: { message: "不允许来自此站点的请求。" } });
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/chat", async (req, res) => {
    const { baseUrl, apiKey, model, messages, temperature } = req.body || {};
    let endpoint;
    try {
      if (typeof baseUrl !== "string") throw new Error();
      endpoint = new URL(baseUrl.trim());
      if (
        !["http:", "https:"].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      )
        throw new Error();
      endpoint.pathname = endpoint.pathname.replace(/\/$/, "");
      if (!endpoint.pathname.endsWith("/chat/completions"))
        endpoint.pathname += "/chat/completions";
    } catch {
      return res
        .status(400)
        .json({
          error: {
            message: "请填写有效的 API 地址，例如 https://api.deepseek.com。",
          },
        });
    }
    if (
      typeof model !== "string" ||
      !model.trim() ||
      typeof apiKey !== "string"
    )
      return res
        .status(400)
        .json({ error: { message: "请检查 API 密钥和模型名称。" } });
    if (
      !Array.isArray(messages) ||
      !messages.length ||
      messages.some(
        (m) =>
          !m ||
          !["system", "user", "assistant"].includes(m.role) ||
          typeof m.content !== "string",
      )
    )
      return res.status(400).json({ error: { message: "消息格式不正确。" } });
    if (
      typeof temperature !== "number" ||
      !Number.isFinite(temperature) ||
      temperature < 0 ||
      temperature > 2
    )
      return res
        .status(400)
        .json({ error: { message: "温度参数应在 0 到 2 之间。" } });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("timeout")),
      180000,
    );
    res.on("close", () => controller.abort());
    let reader;
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey.trim()
            ? { Authorization: `Bearer ${apiKey.trim()}` }
            : {}),
        },
        body: JSON.stringify({
          model: model.trim(),
          messages,
          stream: true,
          ...(/reasoner|^o[134]|^gpt-5/.test(model) ? {} : { temperature }),
        }),
      });
      if (!upstream.ok) {
        const detail = await upstream.json().catch(() => ({}));
        const friendly = {
          401: "API 密钥无效或已过期，请在设置中检查。",
          403: "当前 API 密钥没有访问这个模型的权限。",
          404: "找不到 API 接口或模型，请检查地址和模型名称。",
          429: "请求过于频繁或账户额度不足，请检查额度后重试。",
        }[upstream.status];
        return res
          .status(upstream.status)
          .json({
            error: {
              message:
                friendly ||
                detail.error?.message ||
                `模型服务暂时不可用（${upstream.status}）。`,
            },
          });
      }
      if (
        !upstream.body ||
        !upstream.headers.get("content-type")?.includes("text/event-stream")
      )
        return res
          .status(502)
          .json({
            error: {
              message:
                "服务未返回 SSE 流式响应，请确认 API 兼容 OpenAI Chat Completions。",
            },
          });
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      reader = upstream.body.getReader();
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) {
          await new Promise((resolve) => {
            const cleanup = () => {
              res.off("drain", cleanup);
              res.off("close", cleanup);
              resolve();
            };
            res.once("drain", cleanup);
            res.once("close", cleanup);
          });
        }
      }
      res.end();
    } catch (error) {
      if (res.destroyed) return;
      const message = controller.signal.aborted
        ? "请求超时，请稍后重试。"
        : "无法连接模型服务，请检查 API 地址、网络和代理设置。";
      if (!res.headersSent) res.status(502).json({ error: { message } });
      else res.end(`data: ${JSON.stringify({ error: { message } })}\n\n`);
    } finally {
      clearTimeout(timeout);
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: { message: "接口不存在。" } }),
  );
  if (production) {
    const dist = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../dist",
    );
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((error, _req, res, _next) => {
    res
      .status(error.status || 500)
      .json({
        error: {
          message:
            error.type === "entity.too.large"
              ? "请求内容过大，请缩短对话或附件。"
              : "请求无法处理，请检查数据格式。",
        },
      });
  });
  return app;
}
