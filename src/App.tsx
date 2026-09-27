import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Ellipsis,
  FileText,
  FlaskConical,
  History,
  Leaf,
  Lightbulb,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Paperclip,
  PenLine,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import Logo from "./components/Logo";
import Modal from "./components/Modal";
import Markdown from "./components/Markdown";
import SettingsModal from "./components/SettingsModal";
import { PROVIDERS } from "./types";
import type { Attachment, Conversation, Message, Settings } from "./types";
import {
  downloadFile,
  exportConversations,
  groupConversations,
  loadConversations,
  loadSettings,
  saveConversations,
  saveSettings,
  uid,
  validateConversations,
} from "./lib/storage";
import { streamChat, streamDemo } from "./lib/chat";

const suggestions = [
  [
    {
      icon: PenLine,
      title: "写作灵感",
      description: "让文字，恰好表达你的想法",
      prompt: "帮我写一段温暖、有画面感的周末朋友圈文案，不要太长。",
      color: "purple",
    },
    {
      icon: Code2,
      title: "编程助手",
      description: "和代码难题，一起过过招",
      prompt:
        "我是编程初学者，请用 Python 写一个实用的小例子，并解释其中的思路。",
      color: "blue",
    },
    {
      icon: BookOpen,
      title: "探索新知",
      description: "把不明白，变成原来如此",
      prompt: "请用生活中的例子，向我解释什么是第一性原理。",
      color: "orange",
    },
    {
      icon: Lightbulb,
      title: "效率加一",
      description: "为忙碌的日常，理清头绪",
      prompt: "帮我制定一份兼顾工作、学习和休息的日常计划。",
      color: "green",
    },
  ],
  [
    {
      icon: PenLine,
      title: "表达更出彩",
      description: "给平凡的句子，一点新意",
      prompt: "帮我写一封礼貌而简洁的工作邮件，委婉地向同事提醒项目截止时间。",
      color: "purple",
    },
    {
      icon: Code2,
      title: "代码小课堂",
      description: "每天掌握，一个新技巧",
      prompt: "请解释 JavaScript 的 async / await，并给我一个容易理解的示例。",
      color: "blue",
    },
    {
      icon: BookOpen,
      title: "脑洞时间",
      description: "换个角度，重新看世界",
      prompt: "如果地球上的一天只有 12 小时，人类的生活会发生哪些有趣的变化？",
      color: "orange",
    },
    {
      icon: Lightbulb,
      title: "开始新习惯",
      description: "从小小一步，走向改变",
      prompt: "我想养成每天阅读的习惯，请帮我设计一个轻松坚持的 21 天计划。",
      color: "green",
    },
  ],
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [deep, setDeep] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [suggestionPage, setSuggestionPage] = useState(0);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showScroll, setShowScroll] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nearBottom = useRef(true);
  const notify = useCallback((message: string) => setToast(message), []);
  const active = conversations.find((c) => c.id === activeId);
  const busy = generating !== null;
  const connected =
    !!settings.baseUrl &&
    !!settings.model &&
    (!!settings.apiKey || settings.provider === "custom");
  const provider = PROVIDERS.find((p) => p.id === settings.provider);
  const modelName =
    deep && settings.reasoningModel ? settings.reasoningModel : settings.model;

  useEffect(() => {
    try {
      setConversations(loadConversations());
    } catch {
      setStorageReady(false);
      notify(
        "历史数据无法读取，原始数据已保留。请在「数据管理」中导出原始备份。",
      );
    }
    setLoaded(true);
    return () => abortRef.current?.abort();
  }, [notify]);
  useEffect(() => {
    if (!loaded || !storageReady) return;
    try {
      saveConversations(conversations);
    } catch {
      notify("浏览器存储空间不足，最新对话暂未保存。请及时导出备份。");
    }
  }, [conversations, loaded, storageReady, notify]);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = () =>
      (document.documentElement.dataset.theme =
        settings.theme === "system"
          ? query.matches
            ? "dark"
            : "light"
          : settings.theme);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [settings.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4300);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "0px";
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 180)}px`;
    }
  }, [draft]);
  useEffect(() => {
    if (nearBottom.current && scrollArea.current)
      scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [active?.messages]);
  useEffect(() => {
    nearBottom.current = true;
    setShowScroll(false);
    if (scrollArea.current)
      scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [activeId]);
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setMenuId(null);
        setModelOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);

  function updateSettings(value: Settings) {
    try {
      saveSettings(value);
      setSettings(value);
      setSettingsOpen(false);
      notify(
        value.demo
          ? "已开启演示模式，回复为本地预设内容"
          : "设置已保存，可以开始对话了",
      );
    } catch {
      notify("无法保存设置，请检查浏览器是否允许本地存储。");
    }
  }
  function newChat() {
    setActiveId(null);
    setDraft("");
    setAttachments([]);
    setMobileOpen(false);
    setMenuId(null);
    setTimeout(() => textarea.current?.focus(), 50);
  }
  function selectChat(id: string) {
    setActiveId(id);
    setDraft("");
    setAttachments([]);
    setMobileOpen(false);
    setSearchOpen(false);
    setSearch("");
    setMenuId(null);
  }
  function updateMessage(
    conversationId: string,
    messageId: string,
    transform: (message: Message) => Message,
  ) {
    setConversations((previous) =>
      previous.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? transform(m) : m,
              ),
            }
          : c,
      ),
    );
  }
  async function generate(conversationId: string, messages: Message[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(conversationId);
    nearBottom.current = true;
    const assistant: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      source: settings.demo ? "demo" : "api",
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, updatedAt: Date.now(), messages: [...messages, assistant] }
          : c,
      ),
    );
    try {
      const onChunk = (chunk: { content?: string; reasoning?: string }) =>
        updateMessage(conversationId, assistant.id, (m) => ({
          ...m,
          content: m.content + (chunk.content || ""),
          reasoning: (m.reasoning || "") + (chunk.reasoning || ""),
        }));
      if (settings.demo)
        await streamDemo(
          messages.at(-1)?.content || "",
          controller.signal,
          onChunk,
        );
      else
        await streamChat(settings, messages, deep, controller.signal, onChunk);
      updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        status: "complete",
      }));
    } catch (error) {
      const aborted = controller.signal.aborted;
      updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        status: aborted ? "stopped" : "error",
        error: aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : "生成失败，请稍后重试。",
      }));
    } finally {
      setGenerating(null);
      abortRef.current = null;
    }
  }
  async function sendMessage() {
    if (busy || abortRef.current || !draft.trim()) return;
    if (!settings.demo && !connected) {
      setSettingsOpen(true);
      return;
    }
    if (draft.length > 60000) {
      notify("输入内容过长，请控制在 60,000 字符以内。");
      return;
    }
    const content =
      draft.trim() +
      (attachments.length
        ? "\n\n" +
          attachments.map((a) => `[附件：${a.name}]\n${a.content}`).join("\n\n")
        : "");
    const message: Message = {
      id: uid(),
      role: "user",
      content,
      createdAt: Date.now(),
      attachmentNames: attachments.map((a) => a.name),
    };
    let id = activeId;
    let messages: Message[];
    if (!id || !active) {
      id = uid();
      messages = [message];
      const conversation: Conversation = {
        id,
        title: draft.trim().slice(0, 30),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
        messages,
      };
      setConversations((previous) => [conversation, ...previous]);
      setActiveId(id);
    } else messages = [...active.messages, message];
    setDraft("");
    setAttachments([]);
    setModelOpen(false);
    await generate(id, messages);
  }
  async function regenerate() {
    if (busy || abortRef.current || !active) return;
    if (!settings.demo && !connected) {
      setSettingsOpen(true);
      return;
    }
    const lastUser = active.messages.findLastIndex((m) => m.role === "user");
    if (lastUser >= 0)
      await generate(active.id, active.messages.slice(0, lastUser + 1));
  }
  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      notify("复制失败，请手动选择文字复制。");
    }
  }
  async function addAttachments(files: FileList | null) {
    if (!files) return;
    const added: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (attachments.length + added.length >= 3) {
        notify("每条消息最多添加 3 个文本附件。");
        break;
      }
      if (
        !/\.(txt|md|csv|json|js|ts|tsx|jsx|py|html|css|yaml|yml|xml|log)$/i.test(
          file.name,
        )
      ) {
        notify("暂支持 TXT、Markdown、CSV、JSON 和常见代码文本文件。");
        continue;
      }
      if (file.size > 100 * 1024) {
        notify("单个附件不能超过 100 KB。");
        continue;
      }
      try {
        added.push({ id: uid(), name: file.name, content: await file.text() });
      } catch {
        notify(`无法读取文件：${file.name}`);
      }
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 3));
    if (attachmentInput.current) attachmentInput.current.value = "";
  }
  async function importHistory(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("备份文件不能超过 20 MB。");
      const imported = validateConversations(JSON.parse(await file.text()));
      const existing = new Set(conversations.map((c) => c.id));
      const fresh = imported.filter((c) => !existing.has(c.id));
      setConversations((prev) => [...fresh, ...prev]);
      notify(
        `已导入 ${fresh.length} 个对话${fresh.length < imported.length ? "，重复对话已跳过" : ""}`,
      );
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? "文件不是有效的 JSON 格式。"
          : error instanceof Error
            ? error.message
            : "导入失败。",
      );
    }
    if (importInput.current) importInput.current.value = "";
  }
  function exportMarkdown() {
    if (!active) return;
    downloadFile(
      `${active.title.replace(/[<>:"/\\|?*]/g, "_")}.md`,
      `# ${active.title}\n\n` +
        active.messages
          .map(
            (m) =>
              `## ${m.role === "user" ? "你" : "澄言"}\n\n${m.content}${m.reasoning ? `\n\n<details><summary>思考过程</summary>\n\n${m.reasoning}\n\n</details>` : ""}`,
          )
          .join("\n\n---\n\n"),
      "text/markdown;charset=utf-8",
    );
    notify("对话已导出为 Markdown");
  }
  const searchResults = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(
      (c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.messages.some((m) =>
          m.content.toLowerCase().includes(search.toLowerCase()),
        ),
    );

  const composer = (
    <div className={`composer-section ${active ? "in-conversation" : ""}`}>
      {settings.demo && (
        <div className="demo-indicator">
          <FlaskConical size={13} />
          演示模式 · 回复为本地预设内容
          <button onClick={() => setSettingsOpen(true)}>
            连接真实模型
            <ArrowRight size={12} />
          </button>
        </div>
      )}
      <div className="composer">
        {attachments.length > 0 && (
          <div className="attachments">
            {attachments.map((a) => (
              <span key={a.id}>
                <FileText size={14} />
                {a.name}
                <button
                  aria-label={`移除附件 ${a.name}`}
                  onClick={() =>
                    setAttachments((prev) => prev.filter((f) => f.id !== a.id))
                  }
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={textarea}
          aria-label="输入消息"
          placeholder={
            active ? "继续聊聊，或者提出新的问题…" : "有什么想法，尽管问我…"
          }
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />
        <div className="composer-toolbar">
          <div className="composer-tools">
            <button
              className={`thinking-button ${deep ? "enabled" : ""}`}
              aria-pressed={deep}
              onClick={() => {
                if (!settings.reasoningModel && !settings.demo) {
                  notify("请先在设置中填写深度思考模型。");
                  setSettingsOpen(true);
                } else setDeep(!deep);
              }}
            >
              <Brain size={15} />
              <span>深度思考</span>
              {deep && <Check size={12} />}
            </button>
            <div className="model-select">
              <button
                className="model-button"
                aria-expanded={modelOpen}
                onClick={() => setModelOpen(!modelOpen)}
              >
                <span className="model-dot" />
                <span>
                  {settings.demo ? "演示模型" : modelName || "选择模型"}
                </span>
                <ChevronDown size={13} />
              </button>
              {modelOpen && (
                <>
                  <button
                    className="menu-dismiss"
                    aria-label="关闭模型菜单"
                    onClick={() => setModelOpen(false)}
                  />
                  <div className="model-menu">
                    <p>当前模型</p>
                    <button
                      onClick={() => {
                        setDeep(false);
                        setModelOpen(false);
                      }}
                    >
                      <Zap size={16} />
                      <span>
                        <strong>{settings.model || "未配置"}</strong>
                        <small>日常问答 · 快速响应</small>
                      </span>
                      {!deep && <Check size={14} />}
                    </button>
                    {settings.reasoningModel && (
                      <button
                        onClick={() => {
                          setDeep(true);
                          setModelOpen(false);
                        }}
                      >
                        <Brain size={16} />
                        <span>
                          <strong>{settings.reasoningModel}</strong>
                          <small>复杂问题 · 深度推理</small>
                        </span>
                        {deep && <Check size={14} />}
                      </button>
                    )}
                    <button
                      className="configure-model"
                      onClick={() => {
                        setModelOpen(false);
                        setSettingsOpen(true);
                      }}
                    >
                      <Settings2 size={15} />
                      配置模型连接
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="send-tools">
            <button
              className="icon-button attach-button"
              title="添加文本附件（最多 3 个，每个 100 KB）"
              aria-label="添加文本附件"
              onClick={() => attachmentInput.current?.click()}
            >
              <Paperclip size={20} />
            </button>
            <span className="toolbar-divider" />
            {busy ? (
              <button
                className="send-button stop-button"
                aria-label="停止生成"
                title="停止生成"
                onClick={() => abortRef.current?.abort()}
              >
                <Square size={15} fill="currentColor" />
              </button>
            ) : (
              <button
                className="send-button"
                aria-label="发送消息"
                title="发送消息"
                disabled={!draft.trim()}
                onClick={() => void sendMessage()}
              >
                <ArrowUp size={22} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="composer-caption">
        <span>
          <ShieldCheck size={12} />
          对话仅保存在此浏览器
        </span>
        <span>
          Enter 发送<span className="caption-dot">·</span>Shift + Enter 换行
        </span>
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="关闭侧栏"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <button className="brand" onClick={newChat}>
            <Logo />
            <span>
              澄言<small>CHENGYAN</small>
            </span>
          </button>
          <button
            className="icon-button collapse-button"
            aria-label="收起侧栏"
            onClick={() => {
              setSidebarOpen(false);
              setMobileOpen(false);
            }}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="sidebar-actions">
          <button className="new-chat-button" onClick={newChat}>
            <Plus size={19} />
            <span>开启新对话</span>
            <PenLine size={15} />
          </button>
          <button className="search-button" onClick={() => setSearchOpen(true)}>
            <Search size={17} />
            <span>搜索对话</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>
        <div className="history-heading">
          <span>你的对话</span>
          <button
            className="icon-button"
            aria-label="管理历史对话"
            title="管理历史对话"
            onClick={() => setDataOpen(true)}
          >
            <History size={15} />
          </button>
        </div>
        <div className="history-list">
          {conversations.length ? (
            groupConversations(conversations).map((group) => (
              <section key={group.label} className="history-group">
                <h3>{group.label}</h3>
                {group.items.map((c) => (
                  <div
                    className={`history-item ${activeId === c.id ? "active" : ""}`}
                    key={c.id}
                  >
                    <button
                      className="history-link"
                      onClick={() => selectChat(c.id)}
                    >
                      {c.pinned ? (
                        <Pin size={14} />
                      ) : (
                        <MessageSquare size={15} />
                      )}
                      <span>{c.title}</span>
                      {generating === c.id && (
                        <span className="generating-dot" />
                      )}
                    </button>
                    <button
                      className="history-more icon-button"
                      aria-label={`管理对话：${c.title}`}
                      onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                    >
                      <Ellipsis size={16} />
                    </button>
                    {menuId === c.id && (
                      <>
                        <button
                          className="menu-dismiss"
                          aria-label="关闭对话菜单"
                          onClick={() => setMenuId(null)}
                        />
                        <div className="history-menu">
                          <button
                            onClick={() => {
                              setConversations((prev) =>
                                prev.map((item) =>
                                  item.id === c.id
                                    ? { ...item, pinned: !item.pinned }
                                    : item,
                                ),
                              );
                              setMenuId(null);
                            }}
                          >
                            <Pin size={14} />
                            {c.pinned ? "取消置顶" : "置顶对话"}
                          </button>
                          <button
                            onClick={() => {
                              setRename({ id: c.id, title: c.title });
                              setMenuId(null);
                            }}
                          >
                            <PenLine size={14} />
                            重命名
                          </button>
                          <button
                            className="danger-text"
                            disabled={generating === c.id}
                            onClick={() => {
                              setDeleteId(c.id);
                              setMenuId(null);
                            }}
                          >
                            <Trash2 size={14} />
                            删除对话
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>
            ))
          ) : (
            <div className="history-empty">
              <div className="empty-history-art">
                <MessageCircle size={23} />
                <span>
                  <Sparkles size={11} />
                </span>
              </div>
              <p>每个想法，都值得被记住</p>
              <span>开始对话后，记录会出现在这里</span>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="inspiration-note">
            <span className="note-sparkle">
              <Sparkles size={18} />
            </span>
            <h3>好想法，聊出来。</h3>
            <p>一点好奇，无限可能。</p>
            <span className="note-decoration" />
          </div>
          <button
            className="connection-card"
            onClick={() => setSettingsOpen(true)}
          >
            <span
              className={`connection-icon ${connected || settings.demo ? "is-connected" : ""}`}
            >
              <Zap size={16} />
            </span>
            <span>
              <strong>
                {settings.demo
                  ? "本地演示模式"
                  : connected
                    ? `${provider?.name || "自定义"} 已配置`
                    : "连接你的 AI 模型"}
              </strong>
              <small>
                {settings.demo
                  ? "预设回复 · 无需 API"
                  : connected
                    ? settings.model
                    : "让灵感，即刻回应"}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
          <div className="sidebar-account">
            <span className="user-avatar">言</span>
            <span>
              <strong>我的空间</strong>
              <small>
                <span />
                本地工作空间
              </small>
            </span>
            <button
              className="icon-button"
              aria-label="打开设置"
              title="设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button open-sidebar"
              aria-label="展开侧栏"
              onClick={() => {
                setSidebarOpen(true);
                setMobileOpen(true);
              }}
            >
              <Menu size={19} />
            </button>
            <span className="workspace-label">个人空间</span>
            <ChevronRight className="breadcrumb-arrow" size={13} />
            <span className="page-title">
              {active ? active.title : "新对话"}
            </span>
          </div>
          <div className="topbar-actions">
            {active && (
              <button
                className="icon-button"
                aria-label="导出当前对话"
                title="导出为 Markdown"
                onClick={exportMarkdown}
              >
                <Download size={17} />
              </button>
            )}
            <button
              className={`status-badge ${connected || settings.demo ? "configured" : ""}`}
              onClick={() => setSettingsOpen(true)}
            >
              <span />
              {settings.demo
                ? "演示模式"
                : connected
                  ? provider?.name || "自定义模型"
                  : "连接模型"}
              {!connected && !settings.demo && <ArrowUpRightIcon />}
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button theme-toggle"
              aria-label="切换明暗主题"
              title="切换明暗主题"
              onClick={() => {
                const theme =
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark";
                const next = { ...settings, theme } as Settings;
                try {
                  saveSettings(next);
                  setSettings(next);
                } catch {
                  notify("主题设置无法保存。");
                }
              }}
            >
              {settings.theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
          </div>
        </header>
        {!active ? (
          <div className="welcome-scroll">
            <div className="welcome-content">
              <div className="welcome-hero">
                <div className="hero-mark-wrap">
                  <div className="hero-orbit orbit-one" />
                  <div className="hero-orbit orbit-two" />
                  <span className="hero-star star-one">✦</span>
                  <span className="hero-star star-two">✧</span>
                  <Logo className="hero-mark" />
                </div>
                <div className="hero-eyebrow">
                  <span />
                  你的日常 AI 灵感搭档
                </div>
                <h1>
                  你好，我是<span>澄言</span>
                  <span className="greeting-period">。</span>
                </h1>
                <p>让每一次对话，都离答案更近一点。</p>
              </div>
              {composer}
              <section className="suggestions">
                <div className="suggestions-heading">
                  <span>
                    <WandSparkles size={14} />
                    不妨从这里开始
                  </span>
                  <button
                    onClick={() =>
                      setSuggestionPage((p) => (p + 1) % suggestions.length)
                    }
                  >
                    <RefreshCw size={12} />
                    换一换
                  </button>
                </div>
                <div className="suggestion-grid">
                  {suggestions[suggestionPage].map((s) => (
                    <button
                      className="suggestion-card"
                      key={s.title}
                      onClick={() => {
                        setDraft(s.prompt);
                        textarea.current?.focus();
                      }}
                    >
                      <div className={`suggestion-icon ${s.color}`}>
                        <s.icon size={19} strokeWidth={1.7} />
                      </div>
                      <h3>
                        {s.title}
                        <ArrowRight size={14} />
                      </h3>
                      <p>{s.description}</p>
                    </button>
                  ))}
                </div>
              </section>
              <div className="welcome-bottom">
                <Leaf size={13} />
                <span>不必有完美的问题，想到什么就聊什么。</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="messages-scroll"
              ref={scrollArea}
              onScroll={(e) => {
                const el = e.currentTarget;
                nearBottom.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 110;
                setShowScroll(!nearBottom.current);
              }}
            >
              <div className="message-list">
                <div className="conversation-start">
                  <span />
                  一段新的探索，从这里开始
                  <span />
                </div>
                {active.messages.map((message, index) => (
                  <article
                    className={`message message-${message.role}`}
                    key={message.id}
                  >
                    {message.role === "assistant" && <Logo small />}
                    <div className="message-body">
                      {message.role === "assistant" && (
                        <div className="assistant-label">
                          澄言{message.source === "demo" && <span>演示</span>}
                          {generating === active.id &&
                            index === active.messages.length - 1 && (
                              <span className="writing-label">
                                正在思考
                                <span className="typing-dots">
                                  <i />
                                  <i />
                                  <i />
                                </span>
                              </span>
                            )}
                        </div>
                      )}
                      {message.reasoning && (
                        <details className="reasoning">
                          <summary>
                            <Brain size={14} />
                            思考过程
                            <ChevronDown size={13} />
                          </summary>
                          <Markdown content={message.reasoning} />
                        </details>
                      )}
                      {message.role === "user" ? (
                        <>
                          <div className="user-bubble">
                            {message.attachmentNames?.length
                              ? message.content.split("\n\n[附件：")[0]
                              : message.content}
                          </div>
                          {!!message.attachmentNames?.length && (
                            <div className="message-attachments">
                              {message.attachmentNames.map((name, i) => (
                                <span key={`${name}-${i}`}>
                                  <FileText size={13} />
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {message.content ? (
                            <Markdown content={message.content} />
                          ) : (
                            !message.error &&
                            message.status !== "stopped" && (
                              <div className="waiting-dots">
                                <i />
                                <i />
                                <i />
                              </div>
                            )
                          )}
                          {message.error && (
                            <div className="message-error">
                              <span>{message.error}</span>
                              <button onClick={() => setSettingsOpen(true)}>
                                检查设置
                                <ArrowRight size={12} />
                              </button>
                            </div>
                          )}
                          {message.status === "stopped" && (
                            <div className="stopped-hint">
                              已停止生成
                              {!message.content && "，可以重新生成回复。"}
                            </div>
                          )}
                        </>
                      )}
                      {!(
                        generating === active.id &&
                        index === active.messages.length - 1
                      ) && (
                        <div className="message-actions">
                          <button
                            className="icon-button"
                            aria-label="复制消息"
                            title="复制"
                            onClick={() => void copyMessage(message)}
                          >
                            {copied === message.id ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          {message.role === "assistant" &&
                            index === active.messages.length - 1 && (
                              <button
                                className="icon-button"
                                disabled={busy}
                                aria-label="重新生成"
                                title="重新生成"
                                onClick={() => void regenerate()}
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                          <time>
                            {new Date(message.createdAt).toLocaleTimeString(
                              "zh-CN",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </time>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="chat-bottom">
              {showScroll && (
                <button
                  className="scroll-bottom"
                  aria-label="滚动到底部"
                  onClick={() => {
                    scrollArea.current?.scrollTo({
                      top: scrollArea.current.scrollHeight,
                      behavior: "smooth",
                    });
                    nearBottom.current = true;
                  }}
                >
                  <ArrowDown size={17} />
                </button>
              )}
              {composer}
            </div>
          </>
        )}
        <footer className="page-footer">
          AI 也可能犯错，请核实重要信息<span>澄言 · 让想法自由生长</span>
        </footer>
      </main>
      <input
        ref={attachmentInput}
        type="file"
        className="hidden-input"
        multiple
        accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.yaml,.yml,.xml,.log"
        onChange={(e) => void addAttachments(e.target.files)}
      />
      <input
        ref={importInput}
        type="file"
        className="hidden-input"
        accept=".json"
        onChange={(e) => void importHistory(e.target.files?.[0])}
      />
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={updateSettings}
        />
      )}
      {searchOpen && (
        <Modal
          title="找到那段对话"
          description="搜索标题，或对话中的任意内容。"
          onClose={() => {
            setSearchOpen(false);
            setSearch("");
          }}
        >
          <div className="search-input-wrap">
            <Search size={18} />
            <input
              autoFocus
              aria-label="搜索历史对话"
              placeholder="输入关键词…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>Esc</kbd>
          </div>
          <div className="search-results">
            {searchResults.length ? (
              searchResults.map((c) => (
                <button key={c.id} onClick={() => selectChat(c.id)}>
                  <MessageSquare size={18} />
                  <span>
                    <strong>{c.title}</strong>
                    <small>
                      {c.messages
                        .find((m) =>
                          m.content
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        ?.content.slice(0, 85) || "暂无消息"}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <Search size={27} />
                <p>{search ? "暂时没有找到相关对话" : "还没有历史对话"}</p>
                <span>
                  {search
                    ? "换一个关键词试试吧"
                    : "开启你的第一段对话，想法会被好好保存"}
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}
      {rename && (
        <Modal title="给对话起个名字" onClose={() => setRename(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (rename.title.trim()) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === rename.id
                      ? { ...c, title: rename.title.trim() }
                      : c,
                  ),
                );
                setRename(null);
              }
            }}
          >
            <div className="field rename-field">
              <label htmlFor="conversation-name">对话名称</label>
              <input
                id="conversation-name"
                autoFocus
                maxLength={80}
                value={rename.title}
                onChange={(e) =>
                  setRename({ ...rename, title: e.target.value })
                }
              />
            </div>
            <div className="modal-footer">
              <span />
              <div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setRename(null)}
                >
                  取消
                </button>
                <button
                  className="button primary"
                  disabled={!rename.title.trim()}
                >
                  保存名称
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
      {deleteId && (
        <Modal
          title="删除这段对话？"
          description="删除后无法恢复。如需保留，可以先导出备份。"
          onClose={() => setDeleteId(null)}
        >
          <div className="delete-preview">
            <MessageSquare size={18} />
            {conversations.find((c) => c.id === deleteId)?.title}
          </div>
          <div className="modal-footer">
            <span />
            <div>
              <button
                className="button secondary"
                onClick={() => setDeleteId(null)}
              >
                保留对话
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setConversations((prev) =>
                    prev.filter((c) => c.id !== deleteId),
                  );
                  if (activeId === deleteId) newChat();
                  setDeleteId(null);
                  notify("对话已删除");
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </Modal>
      )}
      {dataOpen && (
        <Modal
          title="管理你的对话"
          description={`目前保存了 ${conversations.length} 段对话，记录仅存在此浏览器。`}
          onClose={() => {
            setDataOpen(false);
            setConfirmClear(false);
          }}
        >
          <div className="data-actions">
            <button
              onClick={() => {
                exportConversations(conversations);
                notify("备份已导出，不包含 API 密钥");
              }}
              disabled={!conversations.length}
            >
              <span className="data-icon">
                <ArrowDownToLine size={21} />
              </span>
              <span>
                <strong>导出全部对话</strong>
                <small>保存为 JSON 文件，随时恢复你的想法</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => importInput.current?.click()}>
              <span className="data-icon">
                <Upload size={21} />
              </span>
              <span>
                <strong>导入对话备份</strong>
                <small>支持澄言 JSON 备份，自动跳过重复对话</small>
              </span>
              <ChevronRight size={17} />
            </button>
            {!storageReady && (
              <button
                onClick={() => {
                  downloadFile(
                    "澄言-原始数据备份.json",
                    localStorage.getItem("chengyan.conversations.v1") || "[]",
                  );
                  notify("原始数据已导出");
                }}
              >
                <span className="data-icon">
                  <Download size={21} />
                </span>
                <span>
                  <strong>导出无法读取的原始数据</strong>
                  <small>保留原始文件，便于恢复</small>
                </span>
              </button>
            )}
          </div>
          <div className="data-privacy">
            <ShieldCheck size={17} />
            <p>
              导出文件只包含对话内容，不包含 API
              密钥。清除浏览器数据会同时移除本地对话，建议定期备份。
            </p>
          </div>
          <div className="data-clear">
            {confirmClear ? (
              <>
                <p>确定清空全部历史吗？此操作无法撤销。</p>
                <div>
                  <button
                    className="button secondary"
                    onClick={() => setConfirmClear(false)}
                  >
                    取消
                  </button>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => {
                      setConversations([]);
                      setStorageReady(true);
                      newChat();
                      setConfirmClear(false);
                      setDataOpen(false);
                      notify("全部历史对话已清空");
                    }}
                  >
                    确认清空
                  </button>
                </div>
              </>
            ) : (
              <button
                className="danger-text"
                disabled={busy || (!conversations.length && storageReady)}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={14} />
                清空全部对话
              </button>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function ArrowUpRightIcon() {
  return <Send size={11} />;
}
