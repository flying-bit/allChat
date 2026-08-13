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
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-muted">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={clsx(
          "rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none transition-colors",
          "focus:border-accent focus:ring-2 focus:ring-accent/30",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
});
