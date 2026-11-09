/**
 * Round WhatsApp button, bottom-right on every storefront page. Opens the
 * store's chat (or group, if set) from Admin → Settings; hidden when neither is set.
 * Phones: sits above the bottom bar, and higher still while a product page's
 * sticky "Add to bag" bar is showing (html[data-sticky-cta], set by ProductPurchase).
 */
export function WhatsappFab({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed right-4 bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom)+1rem)] z-30 grid size-13 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.55)] transition-[bottom,transform] duration-300 ease-out hover:scale-105 active:scale-95 in-data-sticky-cta:bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom)+5rem)] lg:right-8 lg:bottom-8 lg:size-14 lg:in-data-sticky-cta:bottom-8"
    >
      <svg viewBox="0 0 24 24" className="size-7 lg:size-8" fill="currentColor" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.42 9.42 0 0 1-1.45-5.03C2.6 6.82 6.83 2.6 12.05 2.6c2.53 0 4.9.99 6.69 2.78a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.46 9.44zm8.05-17.5A11.3 11.3 0 0 0 12.04.67C5.76.67.65 5.78.65 12.06c0 2 .52 3.97 1.52 5.7L.55 23.67l6.04-1.58a11.4 11.4 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.34-8.06z" />
      </svg>
    </a>
  );
}
