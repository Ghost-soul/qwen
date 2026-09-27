import { afterEach, describe, expect, it, vi } from "vitest";
import {
  groupConversations,
  loadSettings,
  saveSettings,
  validateConversations,
} from "../src/lib/storage";
import { DEFAULT_SETTINGS } from "../src/types";
import type { Conversation } from "../src/types";

function conversation(id = "c1"): Conversation {
  return {
    id,
    title: "一个测试对话",
    createdAt: 1000,
    updatedAt: 2000,
    pinned: false,
    messages: [{ id: "m1", role: "user", content: "你好", createdAt: 1000 }],
  };
}

describe("history import integrity", () => {
  it("round-trips exported conversations without retaining unknown fields", () => {
    const c = { ...conversation(), apiKey: "must-not-import", injected: true };
    expect(validateConversations({ version: 1, conversations: [c] })).toEqual([
      conversation(),
    ]);
  });
  it("rejects malformed data, duplicate identifiers, invalid roles and timestamps", () => {
    for (const data of [
      null,
      {},
      ["text"],
      [conversation(), conversation()],
      [{ ...conversation(), createdAt: "yesterday" }],
      [
        {
          ...conversation(),
          messages: [{ id: "1", role: "system", content: "x", createdAt: 1 }],
        },
      ],
      [
        {
          ...conversation(),
          messages: [conversation().messages[0], conversation().messages[0]],
        },
      ],
    ]) {
      expect(() => validateConversations(data)).toThrow();
    }
  });
  it("recovers unfinished replies as stopped and retains demo provenance", () => {
    const c = conversation();
    c.messages.push({
      id: "m2",
      role: "assistant",
      content: "未完成的回答",
      source: "demo",
      createdAt: 2000,
    });
    const result = validateConversations([c])[0].messages[1];
    expect(result.status).toBe("stopped");
    expect(result.source).toBe("demo");
    expect(result.content).toBe("未完成的回答");
  });
  it("groups pinned and calendar-day histories without mutating input", () => {
    const now = new Date(2026, 8, 27, 12);
    const input = [
      { ...conversation("old"), updatedAt: new Date(2026, 8, 10).getTime() },
      { ...conversation("today"), updatedAt: now.getTime() },
      { ...conversation("pinned"), updatedAt: 1, pinned: true },
      {
        ...conversation("yesterday"),
        updatedAt: new Date(2026, 8, 26, 23).getTime(),
      },
    ];
    expect(
      groupConversations(input, now).map((g) => [g.label, g.items[0].id]),
    ).toEqual([
      ["已置顶", "pinned"],
      ["今天", "today"],
      ["昨天", "yesterday"],
      ["更早", "old"],
    ]);
    expect(input[0].id).toBe("old");
  });
});

describe("API key persistence preference", () => {
  afterEach(() => vi.unstubAllGlobals());
  function mockStorage() {
    const items = new Map<string, string>();
    return {
      setItem: (key: string, value: string) => items.set(key, value),
      getItem: (key: string) => items.get(key) || null,
      removeItem: (key: string) => items.delete(key),
    };
  }
  it("keeps keys out of persistent storage by default and removes remembered keys when disabled", () => {
    const local = mockStorage(),
      session = mockStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    saveSettings({ ...DEFAULT_SETTINGS, apiKey: "test-only-secret" });
    expect(local.getItem("chengyan.settings.v1")).not.toContain(
      "test-only-secret",
    );
    expect(loadSettings().apiKey).toBe("test-only-secret");
    saveSettings({
      ...DEFAULT_SETTINGS,
      apiKey: "remembered-secret",
      rememberKey: true,
    });
    expect(local.getItem("chengyan.settings.v1")).toContain(
      "remembered-secret",
    );
    expect(session.getItem("chengyan.session-key")).toBeNull();
    saveSettings({
      ...DEFAULT_SETTINGS,
      apiKey: "session-again",
      rememberKey: false,
    });
    expect(local.getItem("chengyan.settings.v1")).not.toContain("secret");
    expect(loadSettings().apiKey).toBe("session-again");
  });
});
