import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "gold" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  gold: "bg-gold text-ink-950 shadow-[0_8px_30px_-10px_rgba(212,175,55,0.55)] hover:brightness-110",
  outline:
    "border border-gold-500/60 text-gold-300 hover:bg-gold-500/10 hover:border-gold-400",
  ghost: "text-ivory/80 hover:text-gold-300",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.65rem] tracking-[0.18em]",
  md: "h-11 px-6 text-xs tracking-[0.22em]",
  lg: "h-13 px-8 text-xs tracking-[0.28em]",
};

export function buttonClass(variant: Variant = "gold", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold uppercase transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type Common = { variant?: Variant; size?: Size; className?: string };

export function Button({
  variant,
  size,
  className,
  ...props
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: Common & React.ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
