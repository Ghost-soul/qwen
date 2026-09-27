export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  source?: "demo" | "api";
  status?: "complete" | "stopped" | "error";
  error?: string;
  attachmentNames?: string[];
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  messages: Message[];
};

export type Settings = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  rememberKey: boolean;
  model: string;
  reasoningModel: string;
  temperature: number;
  systemPrompt: string;
  demo: boolean;
  theme: "light" | "dark" | "system";
};

export type Attachment = { id: string; name: string; content: string };

export const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    reasoningModel: "deepseek-reasoner",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    reasoningModel: "qwen3-max",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    reasoningModel: "",
  },
  { id: "custom", name: "自定义", baseUrl: "", model: "", reasoningModel: "" },
];

export const DEFAULT_SETTINGS: Settings = {
  ...PROVIDERS[0],
  provider: "deepseek",
  apiKey: "",
  rememberKey: false,
  temperature: 0.7,
  systemPrompt:
    "你是一位友好、专业的 AI 助手。请默认使用中文，清晰、准确地回答问题。",
  demo: false,
  theme: "light",
};
