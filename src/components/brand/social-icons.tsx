// Brand marks (lucide no longer ships brand icons). Simple single-path glyphs, currentColor.
type P = { className?: string };

export function InstagramIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YoutubeIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsappIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z" />
      <path
        d="M9 8.3c.2-.4.5-.4.8-.4h.4c.2 0 .3.1.4.3l.7 1.6c.1.2 0 .4-.1.5l-.5.6c-.1.1-.1.3 0 .4.6 1 1.4 1.8 2.5 2.4.1.1.3.1.4 0l.6-.6c.1-.1.3-.2.5-.1l1.6.7c.2.1.3.3.3.5v.4c0 .4-.2.8-.6 1-.6.3-1.5.4-2.6-.1-1.6-.7-3.1-2.1-3.9-3.7-.6-1.1-.5-2.2-.3-2.8z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
