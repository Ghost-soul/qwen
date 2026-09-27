import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { createApp } from "../server/app.mjs";

let proxy, upstream, proxyUrl, upstreamUrl, received, upstreamClosed;
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    ),
  );
const close = (server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
const request = (overrides = {}, headers = {}) =>
  fetch(`${proxyUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      baseUrl: `${upstreamUrl}/v1`,
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.7,
      messages: [{ role: "user", content: "你好" }],
      ...overrides,
    }),
  });

beforeAll(async () => {
  upstream = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received = { path: req.url, headers: req.headers, body: JSON.parse(body) };
    if (received.body.model === "unauthorized") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":{"message":"upstream detail"}}');
      return;
    }
    if (received.body.model === "not-stream") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n');
    if (received.body.model === "slow") {
      const timer = setInterval(() => res.write(": waiting\n\n"), 30);
      res.on("close", () => {
        clearInterval(timer);
        upstreamClosed?.();
      });
    } else res.end("data: [DONE]\n\n");
  });
  upstreamUrl = await listen(upstream);
  proxy = http.createServer(createApp());
  proxyUrl = await listen(proxy);
});
afterAll(async () => {
  await close(proxy);
  await close(upstream);
});

describe("real HTTP API proxy against local mock provider", () => {
  it("forwards credentials, context and streams without persisting keys", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("你好");
    expect(received.path).toBe("/v1/chat/completions");
    expect(received.headers.authorization).toBe("Bearer test-key");
    expect(received.body).toEqual({
      model: "test-model",
      temperature: 0.7,
      stream: true,
      messages: [{ role: "user", content: "你好" }],
    });
  });
  it("accepts a full endpoint without appending it twice and supports local keyless providers", async () => {
    await (
      await request({
        baseUrl: `${upstreamUrl}/v1/chat/completions`,
        apiKey: "",
        model: "deepseek-reasoner",
      })
    ).text();
    expect(received.path).toBe("/v1/chat/completions");
    expect(received.headers.authorization).toBeUndefined();
    expect(received.body.temperature).toBeUndefined();
  });
  it("returns understandable authentication and protocol errors", async () => {
    const badKey = await request({ model: "unauthorized" });
    expect(badKey.status).toBe(401);
    expect((await badKey.json()).error.message).toContain("密钥无效");
    const nonSse = await request({ model: "not-stream" });
    expect(nonSse.status).toBe(502);
    expect((await nonSse.json()).error.message).toContain("SSE");
  });
  it("rejects invalid inputs and cross-origin requests", async () => {
    expect((await request({ baseUrl: "file:///etc/passwd" })).status).toBe(400);
    expect(
      (await request({ baseUrl: "https://user:password@example.com" })).status,
    ).toBe(400);
    expect(
      (await request({ messages: [{ role: "invalid", content: "x" }] })).status,
    ).toBe(400);
    expect((await request({ temperature: 9 })).status).toBe(400);
    expect(
      (await request({}, { Origin: "https://unrelated.example" })).status,
    ).toBe(403);
  });
  it("aborts the upstream generation when the client disconnects", async () => {
    const closed = new Promise((resolve) => {
      upstreamClosed = resolve;
    });
    const controller = new AbortController();
    const response = await fetch(`${proxyUrl}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: upstreamUrl,
        apiKey: "",
        model: "slow",
        temperature: 0.5,
        messages: [{ role: "user", content: "test cancellation" }],
      }),
    });
    const reader = response.body.getReader();
    expect((await reader.read()).value.length).toBeGreaterThan(0);
    controller.abort();
    await closed;
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  });
});
