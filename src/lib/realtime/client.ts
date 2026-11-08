"use client";

import { RealtimeClient } from "@supabase/realtime-js";
import { ADMIN_CHANNEL, ADMIN_EVENT, conversationChannel, realtimeConfig, realtimeEnabled } from "./config";

/**
 * Listen for signals on a channel. Returns an unsubscribe function, or null
 * when realtime isn't configured (the caller then checks more often).
 * `onStatus(true)` once connected, `false` when the connection drops.
 */
function subscribe(name: string, onSignal: () => void, onStatus?: (live: boolean) => void): (() => void) | null {
  if (!realtimeEnabled()) return null;
  const client = new RealtimeClient(`${realtimeConfig.url}/realtime/v1`, { params: { apikey: realtimeConfig.key } });
  const channel = client
    .channel(name)
    .on("broadcast", { event: ADMIN_EVENT }, () => onSignal())
    .subscribe((status) => onStatus?.(status === "SUBSCRIBED"));
  return () => {
    void client.removeChannel(channel);
    void client.disconnect();
  };
}

export const subscribeAdminSignals = (onSignal: () => void, onStatus?: (live: boolean) => void) =>
  subscribe(ADMIN_CHANNEL, onSignal, onStatus);

export const subscribeConversation = (conversationId: string, onSignal: () => void, onStatus?: (live: boolean) => void) =>
  subscribe(conversationChannel(conversationId), onSignal, onStatus);
