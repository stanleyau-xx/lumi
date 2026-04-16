import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "#C4724A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Chat bubble shape approximated with divs */}
        <div
          style={{
            position: "relative",
            width: 108,
            height: 90,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Bubble body */}
          <div
            style={{
              width: 108,
              height: 72,
              background: "white",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#C4724A" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#C4724A" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#C4724A" }} />
          </div>
          {/* Tail */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 20,
              width: 0,
              height: 0,
              borderLeft: "12px solid transparent",
              borderRight: "0px solid transparent",
              borderTop: "18px solid white",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
