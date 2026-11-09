"use client";

import { useEffect, useSyncExternalStore } from "react";

import { ROLE_HINT_COOKIE } from "./role-hint-cookie";

/**
 * Reads the role-hint cookie: e.g. "My Account" links straight to /admin for the
 * admin instead of loading the account page first. Every admin page and action
 * still checks the real session.
 */

const noop = () => () => {};

/** True when this browser's last sign-in was the admin's. False on the server. */
export function useIsAdminHint() {
  return useSyncExternalStore(
    noop,
    () => document.cookie.split("; ").includes(`${ROLE_HINT_COOKIE}=admin`),
    () => false,
  );
}

/** Where "My Account" should go for this browser. */
export function useAccountHref() {
  return useIsAdminHint() ? "/admin" : "/account";
}

/**
 * Rendered inside the admin panel (only once the session is checked): writes the
 * hint for sessions that started before it existed, so "My Account" in the store
 * links straight here without a fresh sign-in.
 */
export function AdminRoleHint() {
  useEffect(() => {
    if (document.cookie.split("; ").includes(`${ROLE_HINT_COOKIE}=admin`)) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${ROLE_HINT_COOKIE}=admin; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax${secure}`;
  }, []);
  return null;
}
