import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Monitor,
  Moon,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import Modal from "./Modal";
import { PROVIDERS } from "../types";
import type { Settings } from "../types";

export default function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (value: Settings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState<"connection" | "preferences">("connection");
  const [error, setError] = useState("");
  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError("");
  }
  function save() {
    if (!draft.demo) {
      try {
        const url = new URL(draft.baseUrl);
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error();
      } catch {
        setError("请填写有效的 HTTP 或 HTTPS API 地址。");
        setTab("connection");
        return;
      }
      if (!draft.model.trim()) {
        setError("请填写模型名称。");
        setTab("connection");
        return;
      }
      if (draft.provider !== "custom" && !draft.apiKey.trim()) {
        setError("请填写 API Key，或开启本地演示模式。");
        setTab("connection");
        return;
      }
    }
    onSave({
      ...draft,
      baseUrl: draft.baseUrl.trim().replace(/\/$/, ""),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
      reasoningModel: draft.reasoningModel.trim(),
    });
  }
  return (
    <Modal
      title="让澄言，更懂你"
      description="连接你喜欢的模型，打造自己的对话空间。"
      onClose={onClose}
      wide
    >
      <div className="settings-tabs" role="tablist" aria-label="设置分类">
        <button
          role="tab"
          aria-selected={tab === "connection"}
          className={tab === "connection" ? "selected" : ""}
          onClick={() => setTab("connection")}
        >
          <PlugZap size={16} />
          模型连接
        </button>
        <button
          role="tab"
          aria-selected={tab === "preferences"}
          className={tab === "preferences" ? "selected" : ""}
          onClick={() => setTab("preferences")}
        >
          <SlidersHorizontal size={16} />
          对话偏好
        </button>
      </div>
      <div className="settings-content">
        {tab === "connection" ? (
          <>
            <div className="field">
              <label>服务提供商</label>
              <div className="provider-options">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    className={draft.provider === p.id ? "selected" : ""}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        provider: p.id,
                        baseUrl: p.baseUrl,
                        model: p.model,
                        reasoningModel: p.reasoningModel,
                        apiKey: prev.provider === p.id ? prev.apiKey : "",
                      }));
                      setError("");
                    }}
                  >
                    {p.name}
                    {draft.provider === p.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="api-url">
                API 地址 <span>Base URL</span>
              </label>
              <input
                id="api-url"
                value={draft.baseUrl}
                onChange={(e) => change("baseUrl", e.target.value)}
                placeholder="https://api.example.com/v1"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="field-hint">
                使用兼容 OpenAI Chat Completions 的接口地址。
              </p>
            </div>
            <div className="field">
              <label htmlFor="api-key">
                API 密钥 <KeyRound size={13} />
              </label>
              <div className="input-with-action">
                <input
                  id="api-key"
                  value={draft.apiKey}
                  onChange={(e) => change("apiKey", e.target.value)}
                  type={showKey ? "text" : "password"}
                  placeholder={
                    draft.provider === "custom"
                      ? "本地模型无需密钥时可留空"
                      : "输入你的 API Key"
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="icon-button"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? "隐藏密钥" : "显示密钥"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={draft.rememberKey}
                  onChange={(e) => change("rememberKey", e.target.checked)}
                />
                在此浏览器记住密钥
              </label>
              {draft.rememberKey && (
                <p className="field-hint">
                  密钥会明文保存在此浏览器，请仅在自己的设备上使用。
                </p>
              )}
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="model">对话模型</label>
                <input
                  id="model"
                  value={draft.model}
                  onChange={(e) => change("model", e.target.value)}
                  placeholder="deepseek-chat"
                />
              </div>
              <div className="field">
                <label htmlFor="reasoning-model">
                  深度思考模型 <span>可选</span>
                </label>
                <input
                  id="reasoning-model"
                  value={draft.reasoningModel}
                  onChange={(e) => change("reasoningModel", e.target.value)}
                  placeholder="deepseek-reasoner"
                />
              </div>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={17} />
              <span>
                密钥仅保留在当前标签页会话中（除非选择记住），请求通过本地服务转发到你配置的
                API。
              </span>
            </div>
            <div className="demo-setting">
              <div>
                <FlaskConical size={18} />
                <span>
                  <strong>先体验一下</strong>
                  <small>使用本地预设回复，无需 API 密钥</small>
                </span>
              </div>
              <button
                className={`switch ${draft.demo ? "on" : ""}`}
                role="switch"
                aria-label="本地演示模式"
                aria-checked={draft.demo}
                onClick={() => change("demo", !draft.demo)}
              >
                <span />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>外观主题</label>
              <div className="theme-options">
                {(
                  [
                    { value: "light", label: "浅色", icon: Sun },
                    { value: "dark", label: "深色", icon: Moon },
                    { value: "system", label: "跟随系统", icon: Monitor },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    className={draft.theme === value ? "selected" : ""}
                    key={value}
                    onClick={() => change("theme", value)}
                  >
                    <Icon size={21} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="system-prompt">
                给 AI 的指令 <span>System prompt</span>
              </label>
              <textarea
                id="system-prompt"
                rows={5}
                value={draft.systemPrompt}
                onChange={(e) => change("systemPrompt", e.target.value)}
                placeholder="例如：请用简洁的中文回答，多给一些实际例子。"
              />
              <p className="field-hint">
                这段指令会在每次对话时发送，帮助 AI 理解你的偏好。
              </p>
            </div>
            <div className="field">
              <label htmlFor="temperature">
                回答创造性 <span>{draft.temperature.toFixed(1)}</span>
              </label>
              <input
                id="temperature"
                className="range-input"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={draft.temperature}
                onChange={(e) => change("temperature", Number(e.target.value))}
              />
              <div className="range-labels">
                <span>严谨准确</span>
                <span>自由发散</span>
              </div>
              <p className="field-hint">
                部分推理模型不接受此参数，将使用模型默认值。
              </p>
            </div>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noreferrer"
        >
          获取 DeepSeek API Key <ArrowUpRight size={13} />
        </a>
        <div>
          <button className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" onClick={save}>
            保存设置
          </button>
        </div>
      </div>
    </Modal>
  );
}
