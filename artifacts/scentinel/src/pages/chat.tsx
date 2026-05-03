import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { DupeResult, ContextPick, BlindBuyScore, UserProfile } from "@/types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ToolCall {
  label: string;
  type: "find_dupes" | "score_blind_buy" | "recommend_for_context" | "search_fragrance";
  result: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  isLoading?: boolean;
}

interface ChatProps {
  profile: UserProfile;
  weatherTemp: number;
  weatherDesc: string;
  onMessageSent?: (message: string) => void;
}

const SUGGESTIONS = [
  "Find me a dupe for Creed Aventus under $150",
  "What should I wear to the office today?",
  "Is Tom Ford Oud Wood worth a blind buy?",
  "Best evening fragrance from my collection",
  "Dupe for Sauvage EDP under $80",
  "Recommend something for a summer wedding",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const r = (size / 2) * 0.8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 75 ? "#c49a3c" : score >= 50 ? "#e4a030" : "#c45a3a";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif leading-none" style={{ fontSize: size * 0.35, color }}>{score}</span>
        <span style={{ fontSize: size * 0.14, color: "hsl(40 10% 40%)" }}>/100</span>
      </div>
    </div>
  );
}

// ─── Tool Call Indicator ──────────────────────────────────────────────────────

function ToolCallChip({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded border text-xs w-fit"
      style={{
        background: "hsl(34 12% 9%)",
        borderColor: "hsl(34 10% 14%)",
        color: done ? "hsl(40 10% 55%)" : "hsl(40 10% 40%)",
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: 6, height: 6,
          background: done ? "hsl(174 50% 45%)" : "hsl(42 54% 50%)",
          animation: done ? "none" : "scentinel-pulse 1.2s infinite",
        }}
      />
      <span className="font-mono">{label}</span>
    </div>
  );
}

// ─── Dupe Cards ───────────────────────────────────────────────────────────────

function DupeCards({ dupes }: { dupes: DupeResult[] }) {
  return (
    <div className="grid gap-2 w-full" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
      {dupes.map((d, i) => (
        <div
          key={`${d.house}-${d.name}`}
          className="rounded-xl p-3 border transition-all"
          style={{
            background: i === 0 ? "rgba(196,154,60,0.07)" : "hsl(34 12% 11%)",
            borderColor: i === 0 ? "rgba(196,154,60,0.25)" : "hsl(34 10% 16%)",
          }}
        >
          {i === 0 && (
            <div className="font-mono mb-1" style={{ fontSize: 9, color: "hsl(42 54% 50%)", letterSpacing: "0.08em" }}>
              ★ CLOSEST MATCH
            </div>
          )}
          <div className="mb-1" style={{ fontSize: 10, color: "hsl(40 10% 38%)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {d.house}
          </div>
          <div className="font-serif mb-2 leading-tight" style={{ fontSize: 14, color: "hsl(40 20% 88%)" }}>
            {d.name}
          </div>
          <div className="mb-1" style={{ fontSize: 10, color: "hsl(40 10% 38%)" }}>accord similarity</div>
          <div className="rounded-full overflow-hidden mb-2" style={{ height: 2, background: "hsl(34 12% 16%)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${d.similarity_pct}%`,
                background: "linear-gradient(90deg, hsl(42 40% 32%), hsl(42 54% 50%))",
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono" style={{ fontSize: 11, color: "hsl(42 54% 55%)" }}>{d.similarity_pct}%</span>
            <div className="text-right">
              <div className="font-mono" style={{ fontSize: 12, color: "hsl(40 20% 82%)" }}>${d.price_usd}</div>
              {d.price_delta > 0 && (
                <div style={{ fontSize: 10, color: "#7ab866" }}>save ${d.price_delta}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────

const FLAG_COLORS: Record<string, string> = { ok: "#5a8c4a", info: "hsl(42 54% 50%)", warn: "#c45a3a" };

function ScoreCard({ score }: { score: BlindBuyScore }) {
  return (
    <div
      className="flex gap-4 items-start rounded-xl p-4 border w-full"
      style={{ background: "hsl(34 12% 11%)", borderColor: "hsl(34 10% 16%)" }}
    >
      <ScoreRing score={score.overall_score} />
      <div className="flex-1 min-w-0">
        <div className="mb-2 font-medium" style={{ fontSize: 12, color: "hsl(42 54% 55%)" }}>
          {score.verdict}
        </div>
        <div className="flex flex-col gap-1.5">
          {score.risk_flags.map((flag, i) => (
            <div key={i} className="flex gap-2 items-start" style={{ fontSize: 11, color: "hsl(40 10% 60%)", lineHeight: 1.45 }}>
              <span
                className="rounded-full mt-1 shrink-0"
                style={{ width: 5, height: 5, background: FLAG_COLORS[flag.level] ?? "#7a7a7a" }}
              />
              {flag.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Context Picks ────────────────────────────────────────────────────────────

function ContextPicksCard({ picks }: { picks: ContextPick[] }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {picks.map((pick) => (
        <div
          key={`${pick.name}-${pick.rank}`}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors"
          style={{
            background: pick.rank === 1 ? "hsl(174 40% 10%)" : "hsl(34 12% 11%)",
            borderColor: pick.rank === 1 ? "rgba(58,140,126,0.3)" : "hsl(34 10% 16%)",
          }}
        >
          <span
            className="font-mono shrink-0"
            style={{ fontSize: 11, color: pick.rank === 1 ? "hsl(42 54% 50%)" : "hsl(40 10% 38%)", width: 18 }}
          >
            {String(pick.rank).padStart(2, "0")}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-serif" style={{ fontSize: 14, color: "hsl(40 20% 88%)" }}>{pick.name}</div>
            <div className="truncate" style={{ fontSize: 11, color: pick.rank === 1 ? "hsl(174 50% 50%)" : "hsl(40 10% 48%)" }}>
              {pick.reason}
            </div>
          </div>
          <span className="font-mono shrink-0" style={{ fontSize: 11, color: "hsl(40 10% 50%)" }}>
            {pick.match_pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Rich Result Renderer ─────────────────────────────────────────────────────

function ToolResult({ tc }: { tc: ToolCall }) {
  if (tc.type === "find_dupes" && Array.isArray(tc.result) && tc.result.length > 0) {
    return <DupeCards dupes={tc.result as DupeResult[]} />;
  }
  if (tc.type === "score_blind_buy" && tc.result && typeof tc.result === "object" && "overall_score" in (tc.result as object)) {
    return <ScoreCard score={tc.result as BlindBuyScore} />;
  }
  if (tc.type === "recommend_for_context" && Array.isArray(tc.result) && tc.result.length > 0) {
    return <ContextPicksCard picks={tc.result as ContextPick[]} />;
  }
  return null;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`} style={{ animation: "fadeUp 0.2s ease" }}>
      {/* Avatar */}
      <div
        className="shrink-0 rounded-full flex items-center justify-center font-mono mt-0.5"
        style={{
          width: 28, height: 28, fontSize: 10,
          background: isUser ? "hsl(34 17% 14%)" : "rgba(196,154,60,0.1)",
          border: `1px solid ${isUser ? "hsl(34 10% 20%)" : "rgba(196,154,60,0.25)"}`,
          color: isUser ? "hsl(40 10% 55%)" : "hsl(42 54% 55%)",
        }}
      >
        {isUser ? "U" : "S"}
      </div>

      {/* Body */}
      <div className={`flex flex-col gap-2 min-w-0 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Loading dots */}
        {msg.isLoading && (
          <div
            className="px-4 py-3 rounded-xl border flex gap-1.5 items-center"
            style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 14%)", borderBottomLeftRadius: 4 }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="rounded-full"
                style={{
                  width: 5, height: 5,
                  background: "hsl(40 10% 38%)",
                  animation: `scentinel-pulse 1.2s ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* Tool calls (done) */}
        {!msg.isLoading && msg.toolCalls?.map((tc, i) => (
          <ToolCallChip key={i} label={tc.label} done />
        ))}

        {/* Text bubble */}
        {msg.content && !msg.isLoading && (
          <div
            className="px-4 py-3 rounded-xl border text-sm leading-relaxed"
            style={{
              background: isUser ? "hsl(34 17% 11%)" : "hsl(34 12% 9%)",
              borderColor: isUser ? "hsl(34 10% 20%)" : "hsl(34 10% 14%)",
              color: "hsl(40 20% 88%)",
              borderBottomRightRadius: isUser ? 4 : 12,
              borderBottomLeftRadius: isUser ? 12 : 4,
            }}
            dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
          />
        )}

        {/* Rich results */}
        {!msg.isLoading && msg.toolCalls?.map((tc, i) => (
          <ToolResult key={i} tc={tc} />
        ))}
      </div>
    </div>
  );
}

function formatText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:hsl(42 54% 55%);font-weight:500">$1</strong>')
    .replace(/\n/g, "<br>");
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

function WelcomeScreen({
  weatherTemp, weatherDesc, collectionCount, onSuggest,
}: {
  weatherTemp: number; weatherDesc: string; collectionCount: number; onSuggest: (s: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-12 text-center">
      <div>
        <h2 className="font-serif mb-2" style={{ fontSize: 42, fontWeight: 300, color: "hsl(42 54% 50%)", letterSpacing: "0.06em" }}>
          Scentinel
        </h2>
        <p style={{ fontSize: 13, color: "hsl(40 10% 35%)", lineHeight: 1.7, maxWidth: 340 }}>
          Ask anything — find a dupe, pick something for tonight, or check a blind buy before you commit.
        </p>
      </div>

      {/* Context chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs"
          style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 14%)", color: "hsl(40 10% 50%)" }}
        >
          <span className="rounded-full" style={{ width: 5, height: 5, background: "#7ab866" }} />
          {weatherTemp}°C · {weatherDesc}
        </div>
        {collectionCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs"
            style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 14%)", color: "hsl(40 10% 50%)" }}
          >
            <span className="rounded-full" style={{ width: 5, height: 5, background: "hsl(174 50% 40%)" }} />
            {collectionCount} in collection
          </div>
        )}
      </div>

      {/* Prompt pills */}
      <div className="flex flex-wrap gap-2 justify-center" style={{ maxWidth: 520 }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="px-4 py-2 rounded-full border font-serif transition-all"
            style={{
              background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 14%)",
              fontSize: 13, fontStyle: "italic", color: "hsl(40 10% 50%)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 22%)";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(40 20% 72%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 14%)";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(40 10% 50%)";
            }}
          >
            "{s}"
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Page ────────────────────────────────────────────────────────────────

export default function ChatPage({ profile, weatherTemp, weatherDesc, onMessageSent }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const historyForApi = messages.filter((m) => !m.isLoading).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
      const loadingMsg: ChatMessage = { id: uid(), role: "assistant", content: "", isLoading: true };
      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setInput("");
      if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
      setSending(true);
      onMessageSent?.(trimmed);

      try {
        const res = await fetch(`${BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi,
            profile,
            weatherTemp,
            weatherDesc,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { text: string; toolCalls: ToolCall[] };

        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading
              ? { ...m, id: uid(), isLoading: false, content: data.text, toolCalls: data.toolCalls }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading
              ? { ...m, isLoading: false, content: "Something went wrong. Please try again." }
              : m
          )
        );
      } finally {
        setSending(false);
      }
    },
    [messages, sending, profile, weatherTemp, weatherDesc]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;
  const activeSuggestions = SUGGESTIONS.slice(0, 3);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 scroll-smooth" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(34 10% 18%) transparent" }}>
        {!hasMessages ? (
          <WelcomeScreen
            weatherTemp={weatherTemp}
            weatherDesc={weatherDesc}
            collectionCount={profile.ownedFragrances.length}
            onSuggest={(s) => { setInput(s); textareaRef.current?.focus(); }}
          />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-5 pb-4 pt-3 border-t" style={{ borderColor: "hsl(34 10% 12%)" }}>
        {/* Quick suggestions (only when has messages) */}
        {hasMessages && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {activeSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-1 rounded-full border font-serif transition-all"
                style={{
                  background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 14%)",
                  fontSize: 12, fontStyle: "italic", color: "hsl(40 10% 45%)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "hsl(40 20% 68%)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 22%)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "hsl(40 10% 45%)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 14%)";
                }}
              >
                "{s}"
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any fragrance, occasion, or mood…"
            className="flex-1 rounded-xl px-4 py-3 font-serif text-base resize-none outline-none transition-colors"
            style={{
              background: "hsl(34 12% 9%)", border: "1px solid hsl(34 10% 18%)",
              color: "hsl(40 20% 88%)", fontStyle: "italic", lineHeight: 1.5,
              minHeight: 46, maxHeight: 120,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "hsl(42 40% 32%)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "hsl(34 10% 18%)"; }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-xl flex items-center justify-center transition-all"
            style={{
              width: 42, height: 42,
              background: "rgba(196,154,60,0.1)",
              border: "1px solid rgba(196,154,60,0.25)",
              color: "hsl(42 54% 55%)",
              opacity: sending || !input.trim() ? 0.4 : 1,
              cursor: sending || !input.trim() ? "default" : "pointer",
            }}
          >
            <Send size={15} />
          </button>
        </div>

        <p className="text-center mt-2" style={{ fontSize: 10.5, color: "hsl(40 10% 28%)", letterSpacing: "0.02em" }}>
          Knows your collection · Weather is live · Powered by Claude
        </p>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes scentinel-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
