/**
 * Realtime "something changed" signals for the admin (new order, review…).
 *
 * The signal carries NO data: on receiving it, the admin app fetches the
 * details through our own signed-in Server Action. So the transport can be
 * swapped without touching callers or leaking customer data:
 * - today: Supabase Realtime broadcast (Vercel can't hold WebSockets);
 * - later on a VPS: our own WebSocket server — replace server.ts / client.ts.
 * Without the env vars below, publishing is a no-op and the admin falls back
 * to checking every 20 seconds.
 */
export const realtimeConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  /** The project's publishable key, sb_publishable_… (safe in the browser). */
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export const realtimeEnabled = () => !!(realtimeConfig.url && realtimeConfig.key);

/** Channel the admin app listens on. */
export const ADMIN_CHANNEL = "admin-notifications";
export const ADMIN_EVENT = "changed";

/**
 * One channel per feedback conversation (customer ↔ store). Named by the
 * conversation's random id; like every signal it carries no message text.
 */
export const conversationChannel = (conversationId: string) => `conversation-${conversationId}`;
