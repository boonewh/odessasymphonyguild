import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Breakfast at Tiffany’s — Odessa Symphony Ball, February 27, 2027 at La Hacienda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f8f6ef", color: "#171918", fontFamily: "serif" }}>
        <div style={{ display: "flex", height: 28 }}>
          {Array.from({ length: 30 }, (_, index) => <div key={index} style={{ width: 40, height: 28, background: index % 2 === 0 ? "#171918" : "#f8f6ef" }} />)}
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", margin: 20, border: "2px solid #82cfcc" }}>
          <div style={{ fontSize: 24, letterSpacing: 3 }}>Odessa Symphony Guild presents</div>
          <div style={{ fontSize: 90, marginTop: 26, letterSpacing: -3 }}>Breakfast at Tiffany’s</div>
          <div style={{ fontSize: 26, color: "#286a68", marginTop: 22 }}>The 2027 Symphony Ball &amp; Presentation</div>
          <div style={{ fontSize: 30, marginTop: 38 }}>February 27, 2027 · La Hacienda</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#82cfcc", height: 60, fontSize: 22 }}>A little elegance. A lasting difference.</div>
      </div>
    ),
    size,
  );
}
