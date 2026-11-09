/**
 * Name of the readable (not httpOnly) role-hint cookie, set next to the real
 * session cookie. Only a UI hint (see role-hint.ts) — it grants nothing.
 * Kept in its own file so server code can import it without the client hook.
 */
export const ROLE_HINT_COOKIE = "apna_role";
