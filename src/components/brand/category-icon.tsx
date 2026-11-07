import { Droplets, Footprints, Gem, Glasses, ShoppingBag, Wallet, Watch } from "lucide-react";
import type { LucideProps } from "lucide-react";

/** Lucide has no cap or belt icon; these match its 24px stroke style. */
function CapIcon({ strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M4 15h16c1.5 0 2.5.6 2.5 1.5S21 18 19 18H6a2 2 0 0 1-2-2v-1Z" />
      <path d="M12 7V5.5" />
      <path d="M9 7.6c.6 2 .9 4.5.9 7.4" />
    </svg>
  );
}

function BeltIcon({ strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 10h5M17 10h5M2 14h5M17 14h5" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M11 12h6" />
      <circle cx="19.5" cy="12" r="0.6" />
    </svg>
  );
}

const icons: Record<string, React.ComponentType<LucideProps>> = {
  watches: Watch,
  shoes: Footprints,
  handbags: ShoppingBag,
  wallets: Wallet,
  perfumes: Droplets,
  sunglasses: Glasses,
  caps: CapIcon,
  belts: BeltIcon,
};

export function CategoryIcon({ slug, ...props }: { slug: string } & LucideProps) {
  const Icon = icons[slug] ?? Gem;
  return <Icon {...props} />;
}
