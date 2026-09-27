import { DEFAULT_SETTINGS } from "../types";
import type { Conversation, Message, Settings } from "../types";

const CHAT_KEY = "chengyan.conversations.v1";
const SETTINGS_KEY = "chengyan.settings.v1";
const SESSION_KEY = "chengyan.session-key";
export const uid = () => crypto.randomUUID();

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      apiKey: saved.rememberKey
        ? saved.apiKey || ""
        : sessionStorage.getItem(SESSION_KEY) || "",
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      apiKey: settings.rememberKey ? settings.apiKey : "",
    }),
  );
  if (settings.rememberKey) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, settings.apiKey);
}

export function loadConversations(): Conversation[] {
  const data = localStorage.getItem(CHAT_KEY);
  if (!data) return [];
  return validateConversations(JSON.parse(data));
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(conversations));
}

export function validateConversations(data: unknown): Conversation[] {
  const list = Array.isArray(data)
    ? data
    : (data as { conversations?: unknown } | null)?.conversations;
  if (!Array.isArray(list) || list.length > 1000)
    throw new Error("文件格式不正确，请选择澄言导出的 JSON 文件。");
  const ids = new Set<string>();
  return list.map((item: unknown) => {
    if (!item || typeof item !== "object")
      throw new Error("对话数据格式不正确。");
    const c = item as Conversation;
    if (
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.title !== "string" ||
      !Array.isArray(c.messages) ||
      !Number.isFinite(c.createdAt) ||
      !Number.isFinite(c.updatedAt)
    )
      throw new Error("对话数据缺少必要字段，或包含重复 ID。");
    ids.add(c.id);
    const messageIds = new Set<string>();
    const messages = c.messages.map((m: Message) => {
      if (
        !m ||
        typeof m.id !== "string" ||
        !m.id ||
        messageIds.has(m.id) ||
        !["user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" ||
        !Number.isFinite(m.createdAt)
      )
        throw new Error("消息数据格式不正确。");
      messageIds.add(m.id);
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        reasoning: typeof m.reasoning === "string" ? m.reasoning : undefined,
        status: ["complete", "stopped", "error"].includes(m.status || "")
          ? m.status
          : m.role === "assistant"
            ? ("stopped" as const)
            : undefined,
        source:
          m.source === "demo" || m.source === "api" ? m.source : undefined,
        error: typeof m.error === "string" ? m.error : undefined,
        attachmentNames: Array.isArray(m.attachmentNames)
          ? m.attachmentNames.filter((n) => typeof n === "string")
          : undefined,
      };
    });
    return {
      id: c.id,
      title: c.title.slice(0, 160),
      messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      pinned: !!c.pinned,
    };
  });
}

export function downloadFile(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportConversations(conversations: Conversation[]) {
  downloadFile(
    `澄言-对话备份-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), conversations },
      null,
      2,
    ),
  );
}

export function groupConversations(
  conversations: Conversation[],
  now = new Date(),
) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const groups = [
    { label: "已置顶", items: [] as Conversation[] },
    { label: "今天", items: [] as Conversation[] },
    { label: "昨天", items: [] as Conversation[] },
    { label: "过去 7 天", items: [] as Conversation[] },
    { label: "更早", items: [] as Conversation[] },
  ];
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).getTime();
  const week = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 7,
  ).getTime();
  for (const c of [...conversations].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )) {
    const index = c.pinned
      ? 0
      : c.updatedAt >= start
        ? 1
        : c.updatedAt >= yesterday
          ? 2
          : c.updatedAt >= week
            ? 3
            : 4;
    groups[index].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}
