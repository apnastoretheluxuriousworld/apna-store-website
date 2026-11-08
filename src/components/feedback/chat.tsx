"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, SendHorizontal } from "lucide-react";
import type { ChatMessage, ChatSender } from "@/lib/data/feedback";
import { subscribeConversation } from "@/lib/realtime/client";
import { realtimeEnabled } from "@/lib/realtime/config";
import { cn } from "@/lib/utils";
import { SIGNED_OUT_ERROR, goToSignIn } from "@/lib/auth/signed-out";

/*
 * Live chat between a customer and the store (both sides use this).
 * - Sends optimistically: the bubble shows at once, "Sending…" until saved.
 * - New messages arrive through the conversation's realtime signal, with a
 *   backup check every 60 s (20 s without realtime) and on returning to the tab.
 */

const LIVE_CHECK_MS = 60_000;
const FALLBACK_CHECK_MS = 20_000;
const MAX = 2000;

type Shown = ChatMessage & { status?: "sending" | "failed" };
type SendResult = { ok: true; message: ChatMessage; conversationId?: string } | { ok: false; error: string };
type LoadResult = { conversationId?: string | null; messages: ChatMessage[] } | null;

const TZ = "Asia/Kolkata";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

function dayName(iso: string, now: number) {
  const d = dayKey.format(new Date(iso));
  if (d === dayKey.format(new Date(now))) return "Today";
  if (d === dayKey.format(new Date(now - 86_400_000))) return "Yesterday";
  return dayLabel.format(new Date(iso));
}

/** Saved messages in time order, then the ones still sending / failed. */
function merge(prev: Shown[], incoming: ChatMessage[]): Shown[] {
  const ids = new Set(prev.map((m) => m.id));
  const add = incoming.filter((m) => !ids.has(m.id));
  if (!add.length) return prev;
  const saved = [...prev.filter((m) => !m.status), ...add].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...saved, ...prev.filter((m) => m.status)];
}

const lastSaved = (list: Shown[]) => list.filter((m) => !m.status).at(-1)?.createdAt;

export function Chat({
  side,
  conversationId: initialConversationId,
  initial,
  load,
  send,
  otherName,
  placeholder = "Write a message…",
  prefill = "",
  empty,
  className,
}: {
  /** Whose screen this is: their own messages show on the right. */
  side: ChatSender;
  conversationId: string | null;
  initial: ChatMessage[];
  load: (since: string | undefined, seen: boolean) => Promise<LoadResult>;
  send: (body: string) => Promise<SendResult>;
  otherName: string;
  placeholder?: string;
  prefill?: string;
  empty?: React.ReactNode;
  className?: string;
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Shown[]>(initial);
  const [text, setText] = useState(prefill);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true); // keep scrolled to the newest message unless the reader scrolled up
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ── Loading new messages ── */
  const busy = useRef(false);
  const again = useRef(false);
  const fetchOnce = useCallback(
    async (full = false) => {
      const seen = document.visibilityState === "visible";
      const res = await load(full ? undefined : lastSaved(messagesRef.current), seen).catch(() => null);
      if (!res) return;
      if (res.conversationId) setConversationId(res.conversationId);
      if (res.messages.length) setMessages((prev) => merge(prev, res.messages));
    },
    [load],
  );
  const check = useCallback(
    async (full = false) => {
      if (busy.current) {
        again.current = true;
        return;
      }
      busy.current = true;
      try {
        do {
          again.current = false;
          await fetchOnce(full);
          full = false;
        } while (again.current);
      } finally {
        busy.current = false;
      }
    },
    [fetchOnce],
  );

  // On open: catch up (the page may have been served from the browser cache) and mark read.
  useEffect(() => {
    void check(true);
  }, [check]);

  // Live updates for this conversation.
  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = subscribeConversation(
      conversationId,
      () => void check(),
      (on) => {
        setLive(on);
        if (on) void check();
      },
    );
    return () => unsubscribe?.();
  }, [conversationId, check]);

  // Backup checks while visible; on returning to the tab.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, live ? LIVE_CHECK_MS : FALLBACK_CHECK_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, check]);

  // Scroll to the newest message when one arrives (unless reading older ones).
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ── Sending ── */
  async function deliver(tempId: string, body: string) {
    const res = await send(body).catch(() => ({ ok: false as const, error: "No connection. Tap to try again." }));
    if (res.ok) {
      if (res.conversationId) setConversationId(res.conversationId);
      setMessages((prev) => merge(prev.filter((m) => m.id !== tempId), [res.message]));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      setError(res.error);
      if (res.error === SIGNED_OUT_ERROR) goToSignIn(); // signed out meanwhile: sign in, then back here
    }
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX) {
      setError(`At most ${MAX} characters`);
      return;
    }
    setError(null);
    const tempId = `temp-${crypto.randomUUID()}`;
    stick.current = true;
    setMessages((prev) => [...prev, { id: tempId, sender: side, body, createdAt: new Date().toISOString(), status: "sending" }]);
    setText("");
    input.current?.focus();
    void deliver(tempId, body);
  }

  function retry(m: Shown) {
    setError(null);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "sending" } : x)));
    void deliver(m.id, m.body);
  }

  const days = messages.map((m) => dayName(m.createdAt, now));
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-ink-600/80 bg-ink-850", className)}>
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        aria-live="polite"
        aria-label={`Conversation with ${otherName}`}
      >
        {messages.length === 0 && empty}
        {messages.map((m, i) => {
          const mine = m.sender === side;
          const day = days[i];
          const showDay = i === 0 || day !== days[i - 1];
          return (
            <div key={m.id}>
              {showDay && (
                <p className="py-2 text-center text-[0.65rem] uppercase tracking-[0.18em] text-mute">{day}</p>
              )}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] sm:max-w-[75%]", mine && "text-right")}>
                  {!mine && <p className="mb-0.5 px-1 text-left text-[0.65rem] text-gold-400">{otherName}</p>}
                  <p
                    className={cn(
                      "inline-block rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed whitespace-pre-wrap break-words",
                      mine ? "rounded-br-md border border-gold-500/30 bg-gold-500/15 text-ivory" : "rounded-bl-md bg-ink-700 text-ivory/90",
                      m.status === "sending" && "opacity-60",
                      m.status === "failed" && "border-red-400/50 bg-red-500/10",
                    )}
                  >
                    {m.body}
                  </p>
                  <p className="mt-0.5 px-1 text-[0.65rem] text-mute">
                    {m.status === "sending" ? (
                      "Sending…"
                    ) : m.status === "failed" ? (
                      <button type="button" onClick={() => retry(m)} className="inline-flex items-center gap-1 text-red-300 hover:underline">
                        <AlertCircle className="size-3" /> Not sent · Tap to retry
                      </button>
                    ) : (
                      timeFmt.format(new Date(m.createdAt))
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-ink-600/70 p-2.5 sm:p-3"
      >
        {error && (
          <p role="alert" className="mb-2 px-1 text-xs text-red-400">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Desktop: Enter sends, Shift+Enter adds a line. Phones: the send button.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={MAX}
            placeholder={placeholder}
            aria-label="Message"
            className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-[0.95rem] text-ivory placeholder:text-mute focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink-950 transition-opacity disabled:opacity-40"
          >
            {messages.some((m) => m.status === "sending") ? <Loader2 className="size-4.5 animate-spin" /> : <SendHorizontal className="size-4.5" />}
          </button>
        </div>
        {conversationId && realtimeEnabled() && (
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[0.65rem] text-mute">
            <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-400" : "bg-amber-300")} />
            {live ? "Live" : "Connecting…"}
          </p>
        )}
      </form>
    </div>
  );
}
