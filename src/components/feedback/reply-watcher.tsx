"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchMyChatWatch, fetchMyUnreadCount } from "@/app/(store)/account/feedback/actions";
import { subscribeConversation } from "@/lib/realtime/client";

/** Fired by the chat when a customer's first message starts their conversation. */
export const CONVERSATION_STARTED = "apna:conversation-started";

/**
 * Anywhere in the store: when the store replies to a signed-in customer's
 * feedback, show a toast (the chat page shows the message itself instead).
 * Starts in the browser, so the store layout stays fully static.
 */
export function ReplyWatcher() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const count = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void fetchMyChatWatch()
      .then((w) => {
        if (cancelled || !w) return;
        count.current = w.unread;
        setConversationId(w.conversationId);
      })
      .catch(() => {});
    const onStarted = (e: Event) => setConversationId((e as CustomEvent<string>).detail);
    window.addEventListener(CONVERSATION_STARTED, onStarted);
    return () => {
      cancelled = true;
      window.removeEventListener(CONVERSATION_STARTED, onStarted);
    };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = subscribeConversation(conversationId, async () => {
      if (window.location.pathname === "/account/feedback") return;
      const n = await fetchMyUnreadCount(count.current).catch(() => count.current);
      if (n > count.current) {
        toast("New reply from Apna Store", {
          description: "Tap to read it.",
          duration: 10000,
          action: { label: "Open", onClick: () => router.push("/account/feedback") },
        });
      }
      count.current = n;
    });
    return () => unsubscribe?.();
  }, [conversationId, router]);

  return null;
}
