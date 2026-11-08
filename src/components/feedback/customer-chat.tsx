"use client";

import { MessagesSquare } from "lucide-react";
import { fetchMyMessages, sendCustomerMessage } from "@/app/(store)/account/feedback/actions";
import type { ChatMessage } from "@/lib/data/feedback";
import { Chat } from "./chat";
import { CONVERSATION_STARTED } from "./reply-watcher";

const load = async (since: string | undefined, seen: boolean) => {
  const res = await fetchMyMessages(since, seen);
  return res.ok ? res.data : null;
};

const send = async (body: string) => {
  const res = await sendCustomerMessage(body);
  // First message: let the store-wide watcher start listening for replies.
  if (res.ok) window.dispatchEvent(new CustomEvent(CONVERSATION_STARTED, { detail: res.data.conversationId }));
  return res.ok ? { ok: true as const, message: res.data.message, conversationId: res.data.conversationId } : res;
};

/** The customer's chat with the store (My Account → Feedback). */
export function CustomerChat({ conversationId, initial, prefill }: { conversationId: string | null; initial: ChatMessage[]; prefill?: string }) {
  return (
    <Chat
      side="customer"
      conversationId={conversationId}
      initial={initial}
      load={load}
      send={send}
      otherName="Apna Store"
      prefill={prefill}
      placeholder="Write to us…"
      className="h-[calc(100dvh-19rem)] min-h-96 lg:h-[34rem]"
      empty={
        <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
          <MessagesSquare className="size-9 text-gold-400" strokeWidth={1.2} />
          <p className="mt-3 text-sm text-ivory">How can we help?</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone">
            Questions, feedback or a problem with an order: send us a message and we’ll reply right here.
          </p>
        </div>
      }
    />
  );
}
