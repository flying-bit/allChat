"use client";

import { type ReactNode } from "react";

export function TopBar({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <div className="min-w-0">
          <h1 className="truncate font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
