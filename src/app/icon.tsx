import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const DOT_SIZE = 3.4;

function Dot() {
  return (
    <div
      style={{
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: "50%",
        background: "#5865F2",
        display: "flex",
      }}
    />
  );
}

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5865F2",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            width: 22,
            height: 16,
            background: "#ffffff",
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
            borderBottomLeftRadius: 1.5,
          }}
        >
          <Dot />
          <Dot />
          <Dot />
        </div>
      </div>
    ),
    { ...size }
  );
}
