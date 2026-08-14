export function Logo({ size = 40 }: { size?: number }) {
  const dot = size * 0.11;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[28%] bg-accent"
      style={{ width: size, height: size }}
    >
      <div
        className="flex items-center justify-center bg-white"
        style={{
          width: size * 0.62,
          height: size * 0.45,
          gap: size * 0.09,
          borderTopLeftRadius: size * 0.18,
          borderTopRightRadius: size * 0.18,
          borderBottomRightRadius: size * 0.18,
          borderBottomLeftRadius: size * 0.04,
        }}
      >
        <span className="rounded-full bg-accent" style={{ width: dot, height: dot }} />
        <span className="rounded-full bg-accent" style={{ width: dot, height: dot }} />
        <span className="rounded-full bg-accent" style={{ width: dot, height: dot }} />
      </div>
    </div>
  );
}
