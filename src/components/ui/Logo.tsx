export function Logo({ size = 40 }: { size?: number }) {
  const dot = size * 0.1;
  const bubbleW = size * 0.62;
  const bubbleH = size * 0.44;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-[28%] shadow-md"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #6875F5 0%, #4752C4 100%)",
      }}
    >
      <div
        className="relative flex items-center justify-center bg-white shadow-sm"
        style={{
          width: bubbleW,
          height: bubbleH,
          gap: size * 0.085,
          borderTopLeftRadius: size * 0.16,
          borderTopRightRadius: size * 0.16,
          borderBottomRightRadius: size * 0.16,
          borderBottomLeftRadius: size * 0.035,
        }}
      >
        <span className="rounded-full bg-[#5865F2]" style={{ width: dot, height: dot }} />
        <span className="rounded-full bg-[#5865F2]" style={{ width: dot, height: dot }} />
        <span className="rounded-full bg-[#5865F2]" style={{ width: dot, height: dot }} />
        <span
          className="absolute bg-white"
          style={{
            width: size * 0.1,
            height: size * 0.1,
            left: size * 0.05,
            bottom: size * -0.025,
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
          }}
        />
      </div>
    </div>
  );
}
