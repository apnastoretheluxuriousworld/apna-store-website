/**
 * Shared by customer Server Actions and their forms: an action returns this
 * error when nobody (or the admin) is signed in, and the form then sends the
 * customer to sign in and back.
 */
export const SIGNED_OUT_ERROR = "Please sign in to continue.";

export function goToSignIn() {
  const here = window.location.pathname + window.location.search;
  // A full load on purpose: drops the signed-out pages kept in the browser cache.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/account/login?next=${encodeURIComponent(here)}`);
}
