/**
 * Shared by the server page and the client toggle. Must not live in the
 * "use client" file: a server import from there gets a client reference, not
 * the string, so the server could never read the cookie.
 */
export type ProductsView = "list" | "grid";
export const PRODUCTS_VIEW_COOKIE = "admin_products_view";
