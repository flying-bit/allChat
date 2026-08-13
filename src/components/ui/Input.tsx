"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props },
  ref
) {
  return (
    <label className={clsx("flex min-w-0 flex-col gap-1 text-sm", className)} htmlFor={id}>
      {label && <span className="font-medium text-muted">{label}</span>}
      <input
        ref={ref}
        id={id}
        className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
});
