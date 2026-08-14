import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const DOT_SIZE = 19;

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

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6875F5 0%, #4752C4 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 17,
            width: 124,
            height: 90,
            background: "#ffffff",
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            borderBottomRightRadius: 34,
            borderBottomLeftRadius: 8,
            boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
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
