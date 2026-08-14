"use client";

import { gradientFor } from "@/lib/color";

export function Avatar({
  name,
  src,
  size = 40,
  online,
}: {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
  const background = gradientFor(name || "?");

  return (
    <div className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white shadow-sm select-none"
          style={{ background, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-surface"
          style={{
            width: size * 0.3,
            height: size * 0.3,
            backgroundColor: online ? "var(--online)" : "var(--offline)",
          }}
        />
      )}
    </div>
  );
}
