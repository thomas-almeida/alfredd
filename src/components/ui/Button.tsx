import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 border border-transparent rounded-sm font-medium text-[13px] leading-none whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-3.5 py-2",
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg font-semibold hover:brightness-110",
  secondary:
    "bg-surface-2 border-border-strong text-fg hover:bg-surface-hover",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "border-danger text-danger hover:bg-danger/15",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}
