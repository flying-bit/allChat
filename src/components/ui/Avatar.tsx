"use client";

const COLORS = ["#FBC02D", "#FF8F00", "#C62828", "#8D6E63", "#455A64", "#00897B"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function Avatar({
  name,
  size = 40,
  online,
}: {
  name: string;
  size?: number;
  online?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
  const bg = colorFor(name || "?");

  return (
    <div className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white select-none"
        style={{ backgroundColor: bg, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-surface ${
            online ? "bg-green-500" : "bg-gray-400"
          }`}
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </div>
  );
}
