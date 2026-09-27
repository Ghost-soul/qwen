import { describe, expect, it } from "vitest";
import { readChatStream, streamChat } from "../src/lib/chat";
import { DEFAULT_SETTINGS } from "../src/types";

function responseFromChunks(text: string, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize)
          controller.enqueue(bytes.slice(i, i + chunkSize));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("streaming chat protocol", () => {
  it("decodes Chinese UTF-8 split across byte boundaries, CRLF and reasoning", async () => {
    const data =
      ': keepalive\r\n\r\ndata: {"choices":[{"delta":{"reasoning_content":"想一想"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"你好，世界🌿"}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
    let content = "",
      reasoning = "";
    await readChatStream(responseFromChunks(data), (c) => {
      content += c.content || "";
      reasoning += c.reasoning || "";
    });
    expect(content).toBe("你好，世界🌿");
    expect(reasoning).toBe("想一想");
  });
  it("accepts finish_reason and a final frame without a separator", async () => {
    const chunks: string[] = [];
    await readChatStream(
      responseFromChunks(
        'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}',
        19,
      ),
      (c) => chunks.push(c.content || ""),
    );
    expect(chunks.join("")).toBe("ok");
  });
  it("preserves partial output but reports a truncated connection", async () => {
    const chunks: string[] = [];
    await expect(
      readChatStream(
        responseFromChunks(
          'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
        ),
        (c) => chunks.push(c.content || ""),
      ),
    ).rejects.toThrow("连接意外中断");
    expect(chunks.join("")).toBe("partial");
  });
  it("reports service errors and empty content", async () => {
    await expect(
      readChatStream(
        new Response(JSON.stringify({ error: { message: "密钥无效" } }), {
          status: 401,
        }),
        () => {},
      ),
    ).rejects.toThrow("密钥无效");
    await expect(
      readChatStream(
        responseFromChunks('data: {"error":{"message":"Quota exceeded"}}\n\n'),
        () => {},
      ),
    ).rejects.toThrow("Quota exceeded");
    await expect(
      readChatStream(responseFromChunks("data: [DONE]\n\n"), () => {}),
    ).rejects.toThrow("空内容");
  });
  it("rejects malformed JSON frames instead of silently dropping them", async () => {
    await expect(
      readChatStream(responseFromChunks("data: {broken}\n\n"), () => {}),
    ).rejects.toThrow("无法解析");
  });
  it("propagates cancellation to the reader", async () => {
    const response = new Response(
      new ReadableStream({
        start(c) {
          c.error(new DOMException("Aborted", "AbortError"));
        },
      }),
    );
    await expect(readChatStream(response, () => {})).rejects.toMatchObject({
      name: "AbortError",
    });
  });
  it("sends context with the system prompt and chosen reasoning model, excluding failed replies", async () => {
    const { vi } = await import("vitest");
    let payload: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        payload = JSON.parse(init.body);
        return responseFromChunks(
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
        );
      }),
    );
    try {
      await streamChat(
        DEFAULT_SETTINGS,
        [
          { id: "1", role: "user", content: "hi", createdAt: 1 },
          {
            id: "2",
            role: "assistant",
            content: "partial",
            status: "error",
            createdAt: 2,
          },
          { id: "3", role: "user", content: "continue", createdAt: 3 },
        ],
        true,
        new AbortController().signal,
        () => {},
      );
      expect(payload.model).toBe("deepseek-reasoner");
      expect(payload.messages).toEqual([
        { role: "system", content: DEFAULT_SETTINGS.systemPrompt },
        { role: "user", content: "hi" },
        { role: "user", content: "continue" },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
