"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "motion/react";
import { clsx } from "@/lib/clsx";

type Variant = "primary" | "ghost" | "danger" | "outline";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
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
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.03 }}
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0.4 }}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {/* children stay mounted (just hidden) while loading, so refs inside them stay valid */}
      <span className={clsx("inline-flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
      {loading && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
            className="h-4 w-4 rounded-full border-2 border-current border-t-transparent opacity-80"
          />
        </motion.span>
      )}
    </motion.button>
  );
});
