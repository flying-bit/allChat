"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/clsx";

type Variant = "primary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:brightness-95 active:brightness-90 disabled:opacity-50",
  ghost: "bg-transparent text-foreground hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-95 active:brightness-90 disabled:opacity-50",
  outline: "bg-transparent border border-border text-foreground hover:bg-surface-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {loading ? "..." : children}
    </button>
  );
});
