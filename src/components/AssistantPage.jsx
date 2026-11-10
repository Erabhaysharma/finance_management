import { useEffect, useRef, useState } from "react";
import { Menu, X, Plus, Send, MessageSquare, Trash2, Bot, Sparkles, Wrench, RotateCcw } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import "./AssistantPage.css";

// ---- Config -------------------------------------------------------------
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const CHAT_ENDPOINT = `${API_URL}/assistant/chat`;

const MODES = [
  { id: "chat", label: "Chat", icon: MessageSquare, hint: "Chat mode: ask questions and get answers." },
  { id: "agent", label: "Agent", icon: Wrench, hint: "Agent mode: Arth Saarthi can take actions on your data." },
];

const SUGGESTIONS = {
  chat: [
    "How much did I spend this month?",
    "Explain GST in simple words",
    "Ways to reduce monthly expenses",
  ],
  agent: [
    "Add an expense of ₹500 for fuel today",
    "Remind me to collect pending payments tomorrow",
    "Prepare this month's profit & loss report",
  ],
};

// ---- Helpers ------------------------------------------------------------
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const newChat = (mode = "chat") => ({ id: uid(), title: "New chat", mode, messages: [], updatedAt: Date.now() });

function loadChats(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function formatWhen(ts) {
  const d = new Date(ts);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// ---- Component ----------------------------------------------------------
export default function AssistantPage() {
  const { session } = useAuth();
  const storageKey = `arth-saarthi-chats:${session?.user?.id || "guest"}`;

  const [chats, setChats] = useState(() => {
    const saved = loadChats(storageKey);
    return [newChat(), ...saved];
  });
  const [activeId, setActiveId] = useState(() => chats[0].id);
  const [input, setInput] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const active = chats.find((c) => c.id === activeId) || chats[0];
  const loading = pendingId === active.id;
  const history = chats.filter((c) => c.messages.length > 0).sort((a, b) => b.updatedAt - a.updatedAt);

  // Save chats that have at least one message.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(chats.filter((c) => c.messages.length > 0)));
    } catch {
      /* storage full or blocked: chat still works, history just won't persist */
    }
  }, [chats, storageKey]);

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [active.messages.length, loading, activeId]);

  const updateChat = (id, fn) => setChats((all) => all.map((c) => (c.id === id ? fn(c) : c)));

  // Calls the backend. `mode` is sent on every request so the API knows how to respond.
  const request = async (chatId, mode, content, priorMessages) => {
    setPendingId(chatId);
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: content,
          mode, // "chat" | "agent"
          conversation_id: chatId,
          history: priorMessages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      updateChat(chatId, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: [
          ...c.messages,
          { id: uid(), role: "assistant", content: data.reply ?? "", steps: data.steps, mode },
        ],
      }));
    } catch (e) {
      updateChat(chatId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: uid(), role: "assistant", error: true, content: `Couldn't get a reply. ${e.message || ""}`.trim() },
        ],
      }));
    } finally {
      setPendingId(null);
    }
  };

  const send = (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const prior = active.messages;
    const userMsg = { id: uid(), role: "user", content, mode: active.mode };
    updateChat(active.id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 48) : c.title,
      updatedAt: Date.now(),
      messages: [...c.messages, userMsg],
    }));
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    request(active.id, active.mode, content, prior);
  };

  const retry = (errorMsgId) => {
    const idx = active.messages.findIndex((m) => m.id === errorMsgId);
    const lastUser = [...active.messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const prior = active.messages.slice(0, idx - 1);
    updateChat(active.id, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== errorMsgId) }));
    request(active.id, lastUser.mode || active.mode, lastUser.content, prior);
  };

  const setMode = (mode) => updateChat(active.id, (c) => ({ ...c, mode }));

  const startNewChat = () => {
    // Reuse the current chat if it is still empty.
    if (active.messages.length === 0) {
      setMenuOpen(false);
      return;
    }
    const c = newChat(active.mode);
    setChats((all) => [c, ...all]);
    setActiveId(c.id);
    setMenuOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const openChat = (id) => {
    setActiveId(id);
    setMenuOpen(false);
  };

  const deleteChat = (id) => {
    const remaining = chats.filter((c) => c.id !== id);
    if (id === activeId) {
      const fresh = newChat(active.mode);
      setChats([fresh, ...remaining]);
      setActiveId(fresh.id);
    } else {
      setChats(remaining);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const onInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
  };

  const modeInfo = MODES.find((m) => m.id === active.mode);

  return (
    <section className="as-root">
      {/* Top bar: title | mode switch | menu */}
      <header className="as-top">
        <div className="as-title">
          <Bot size={20} />
          <span>Arth Saarthi</span>
        </div>

        <div className="as-modes" role="tablist" aria-label="Assistant mode">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={active.mode === id}
              className={"as-mode" + (active.mode === id ? " is-on" : "")}
              onClick={() => setMode(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="as-top-right">
          <button className="as-icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open chat menu">
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="as-scroll" ref={scrollRef}>
        {active.messages.length === 0 ? (
          <div className="as-empty">
            <div className="as-empty-mark"><Sparkles size={22} /></div>
            <h2>How can I help with your finances today?</h2>
            <p>{modeInfo.hint}</p>
            <div className="as-suggest">
              {SUGGESTIONS[active.mode].map((s) => (
                <button key={s} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="as-thread">
            {active.messages.map((m) => (
              <div key={m.id} className={"as-msg " + (m.role === "user" ? "is-user" : "is-bot") + (m.error ? " is-error" : "")}>
                {m.role === "assistant" && (
                  <span className="as-avatar"><Bot size={16} /></span>
                )}
                <div className="as-bubble">
                  {m.steps?.length > 0 && (
                    <div className="as-steps">
                      {m.steps.map((s, i) => (
                        <span key={i} className="as-step"><Wrench size={12} />{typeof s === "string" ? s : s.label || s.tool}</span>
                      ))}
                    </div>
                  )}
                  <div className="as-text">{m.content}</div>
                  {m.error && (
                    <button className="as-retry" onClick={() => retry(m.id)}>
                      <RotateCcw size={13} /> Try again
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="as-msg is-bot">
                <span className="as-avatar"><Bot size={16} /></span>
                <div className="as-bubble as-typing" aria-label="Arth Saarthi is typing">
                  <i /><i /><i />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer + footer */}
      <div className="as-bottom">
        <div className="as-composer">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder={active.mode === "agent" ? "Tell Arth Saarthi what to do…" : "Ask Arth Saarthi anything…"}
            aria-label="Message"
          />
          <button className="as-send" onClick={() => send()} disabled={!input.trim() || loading} aria-label="Send message">
            <Send size={18} />
          </button>
        </div>
        <p className="as-foot">
         Kritrim Saarthi Present Arth Saarthi.Powered by Narayan Research and Development
        </p>
      </div>

      {/* History drawer */}
      <div className={"as-overlay" + (menuOpen ? " is-open" : "")} onClick={() => setMenuOpen(false)} />
      <aside className={"as-drawer" + (menuOpen ? " is-open" : "")} aria-hidden={!menuOpen}>
        <div className="as-drawer-head">
          <strong>Chats</strong>
          <button className="as-icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close chat menu">
            <X size={20} />
          </button>
        </div>
        <button className="as-new" onClick={startNewChat}>
          <Plus size={16} /> New chat
        </button>
        <div className="as-hist-label">History</div>
        <div className="as-hist">
          {history.length === 0 && <p className="as-hist-empty">Your conversations will show up here.</p>}
          {history.map((c) => (
            <div key={c.id} className={"as-hist-item" + (c.id === active.id ? " is-on" : "")}>
              <button className="as-hist-main" onClick={() => openChat(c.id)}>
                <span className="as-hist-title">{c.title}</span>
                <span className="as-hist-meta">{c.mode === "agent" ? "Agent" : "Chat"} · {formatWhen(c.updatedAt)}</span>
              </button>
              <button className="as-icon-btn as-del" onClick={() => deleteChat(c.id)} aria-label={`Delete chat ${c.title}`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}