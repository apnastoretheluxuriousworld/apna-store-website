import "server-only";
import { RealtimeClient } from "@supabase/realtime-js";
import { ADMIN_CHANNEL, ADMIN_EVENT, conversationChannel, realtimeConfig, realtimeEnabled } from "./config";

/**
 * Send a "something changed" signal on a channel. Fire-and-forget: never
 * throws (the periodic checks catch up if it's lost).
 */
async function signal(channel: string) {
  if (!realtimeEnabled()) return;
  try {
    // REST send: no WebSocket is opened on the server.
    const client = new RealtimeClient(`${realtimeConfig.url}/realtime/v1`, { params: { apikey: realtimeConfig.key } });
    await client.channel(channel).httpSend(ADMIN_EVENT, { at: Date.now() }, { timeout: 3000 });
  } catch (e) {
    console.warn("[realtime] signal failed", e instanceof Error ? e.message : e);
  }
}

/** Tell open admin screens to check for news. */
export const signalAdmins = () => signal(ADMIN_CHANNEL);

/** Tell both sides of a feedback conversation that a message arrived. */
export const signalConversation = (conversationId: string) => signal(conversationChannel(conversationId));
