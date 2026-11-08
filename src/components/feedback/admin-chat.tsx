"use client";

import { useCallback, useEffect } from "react";
import { fetchConversation, sendAdminReply } from "@/app/admin/(panel)/feedback/actions";
import { useNotifications } from "@/components/admin/notifications";
import type { ChatMessage } from "@/lib/data/feedback";
import { Chat } from "./chat";

/** The store's side of a customer's feedback chat. */
export function AdminChat({ conversationId, customerName, initial }: { conversationId: string; customerName: string; initial: ChatMessage[] }) {
  const notifications = useNotifications();
  const href = `/admin/feedback/${conversationId}`;

  // Opening the chat reads its notification: clear it from the bell at once (the server does the same).
  const unreadHere = notifications?.items.filter((n) => n.href === href && !n.read).map((n) => n.id) ?? [];
  const key = unreadHere.join(",");
  const markRead = notifications?.markRead;
  useEffect(() => {
    if (key && markRead && document.visibilityState === "visible") markRead(key.split(","));
  }, [key, markRead]);

  const load = useCallback(
    async (since: string | undefined, seen: boolean) => {
      const res = await fetchConversation(conversationId, since, seen);
      return res.ok ? res.data : null;
    },
    [conversationId],
  );
  const send = useCallback(
    async (body: string) => {
      const res = await sendAdminReply(conversationId, body);
      return res.ok ? { ok: true as const, message: res.data.message } : res;
    },
    [conversationId],
  );

  return (
    <Chat
      side="admin"
      conversationId={conversationId}
      initial={initial}
      load={load}
      send={send}
      otherName={customerName}
      placeholder={`Reply to ${customerName.split(" ")[0]}…`}
      className="h-[calc(100dvh-17rem)] min-h-96 lg:h-[calc(100dvh-14rem)]"
    />
  );
}
