import type { Message, Settings } from "../types";

export type StreamChunk = { content?: string; reasoning?: string };

/** SSE frames can span reads, include CRLF, and contain multiple data lines. */
export async function readChatStream(
  response: Response,
  onChunk: (chunk: StreamChunk) => void,
) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || error.message || `请求失败（${response.status}）`,
    );
  }
  if (!response.body) throw new Error("未收到响应内容。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let received = false;
  let finished = false;
  function consume(frame: string) {
    const data = frame
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data) return;
    if (data === "[DONE]") {
      finished = true;
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error(
        "服务返回了无法解析的流式数据。请检查 API 是否兼容 OpenAI。",
      );
    }
    if (parsed.error)
      throw new Error(parsed.error.message || "服务在生成过程中返回错误。");
    const choice = parsed.choices?.[0];
    const delta = choice?.delta;
    if (choice?.finish_reason) finished = true;
    if (
      typeof delta?.content === "string" ||
      typeof delta?.reasoning_content === "string"
    ) {
      received = true;
      onChunk({ content: delta.content, reasoning: delta.reasoning_content });
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        consume(frame);
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!received)
      throw new Error("模型返回了空内容，请检查模型名称或稍后重试。");
    if (!finished)
      throw new Error("连接意外中断，已保留收到的内容。你可以重新生成。");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamChat(
  settings: Settings,
  messages: Message[],
  deep: boolean,
  signal: AbortSignal,
  onChunk: (chunk: StreamChunk) => void,
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model:
        deep && settings.reasoningModel
          ? settings.reasoningModel
          : settings.model,
      temperature: settings.temperature,
      messages: [
        ...(settings.systemPrompt.trim()
          ? [{ role: "system", content: settings.systemPrompt }]
          : []),
        ...messages
          .filter((m) => m.content && m.status !== "error")
          .map(({ role, content }) => ({ role, content })),
      ],
    }),
  });
  await readChatStream(response, onChunk);
}

export async function streamDemo(
  prompt: string,
  signal: AbortSignal,
  onChunk: (chunk: StreamChunk) => void,
) {
  let answer: string;
  if (/代码|编程|python|javascript|函数/i.test(prompt)) {
    answer =
      '当然！我们用一个简单的例子，感受一下代码的乐趣。\n\n### 用 Python 写一个每日问候\n\n```python\nfrom datetime import datetime\n\ndef say_hello(name: str) -> str:\n    hour = datetime.now().hour\n    greeting = "早上好" if hour < 12 else "下午好"\n    return f"{greeting}，{name}！今天也要保持好奇。"\n\nprint(say_hello("朋友"))\n```\n\n这段代码做了三件事：\n\n1. 获取当前时间，判断上午还是下午。\n2. 用函数封装逻辑，让代码更容易复用。\n3. 通过 **f-string** 生成一句专属问候。\n\n你也可以告诉我你的具体需求，我们一起把想法变成代码。';
  } else if (/计划|效率|安排|学习/.test(prompt)) {
    answer =
      "好呀，让我们给忙碌的生活留出一点从容。这里是一份可以直接开始的行动计划。\n\n### 先找到真正重要的事\n\n与其把每一分钟填满，不如每天专注完成 **3 件最重要的事**。\n\n| 时间 | 安排 | 小建议 |\n| --- | --- | --- |\n| 09:00 – 10:30 | 专注处理最重要的任务 | 关闭不必要的通知 |\n| 10:30 – 10:45 | 休息与整理 | 起身走动，喝一杯水 |\n| 10:45 – 12:00 | 学习与练习 | 把知识写成自己的笔记 |\n| 14:00 – 16:00 | 沟通与协作 | 集中回复消息 |\n| 16:00 – 16:30 | 复盘与计划 | 记录今天的小进步 |\n\n> 计划的意义，是让你更自由，而不是让你更焦虑。\n\n你可以告诉我你的目标、可用时间和目前遇到的困难，我会帮你进一步细化。";
  } else if (/写|文案|灵感|创作/.test(prompt)) {
    answer =
      "灵感有时就藏在日常的小事里。我们可以从这几个方向开始：\n\n### 01 · 从一个真实的瞬间出发\n清晨窗边的一束光、通勤路上的一首歌，或者一杯刚刚好的咖啡，都能成为故事的开头。\n\n### 02 · 给熟悉的事物一个新视角\n试着问自己：**如果换一个人的眼睛看，这件事会有什么不同？**\n\n### 03 · 先写下来，再慢慢打磨\n第一稿的任务是让想法出现。把精修留给第二稿，创作会轻松很多。\n\n> “不必等到准备好了才出发，有些答案，会在路上慢慢清晰。”\n\n如果你愿意，可以补充主题、目标读者和想要的风格，我们一起写出更贴合你的内容。";
  } else {
    answer =
      "你好，很高兴在这里遇见你。🌿\n\n我是**澄言**，你的日常 AI 灵感搭档。无论是一个还没成形的想法，还是一个想弄明白的问题，都可以从这里开始。\n\n我可以陪你：\n\n- **探索新知**：把复杂的概念讲得清楚一点。\n- **写作与表达**：从第一句到最后一次润色。\n- **编程与解决问题**：一起拆解思路，找到方法。\n- **规划日常**：让工作和生活更有条理。\n\n你刚才说的内容我已经收到。当前是**本地演示模式**，这里展示的是预设回复；在左下角的「设置」中连接 API 后，就可以获得针对问题的真实回答。";
  }
  for (let i = 0; i < answer.length; i += 5) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    onChunk({ content: answer.slice(i, i + 5) });
    await new Promise((resolve) => setTimeout(resolve, 14));
  }
}
