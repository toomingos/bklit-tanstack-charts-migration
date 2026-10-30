import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { allCharts } from "@/lib/chart-data";

// Link preview card (og:image / twitter:image), rendered once at build time.
export const alt = "Bklit TanStack Charts: Bklit UI's charts, now on TanStack.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fonts = path.join(process.cwd(), "node_modules/geist/dist/fonts");

// Dark theme tokens from app/globals.css (zinc ramp, strongest series first).
const bg = "#09090b";
const fg = "#fafafa";
const muted = "#a1a1aa";
const border = "#27272a";
const series = ["#e4e4e7", "#71717a"];

const W = 1200;
const H = 300;
const users = [32, 38, 35, 46, 42, 55, 51, 63, 58, 71, 68, 79, 74, 88];
const views = [18, 22, 20, 27, 25, 31, 29, 36, 33, 41, 39, 45, 43, 50];

// Catmull-Rom through the points, as a cubic Bézier path; `close` drops it to the baseline for the area fill.
const smooth = (values: number[], close: boolean): string => {
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - (v / 100) * H] as const);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return close ? `${d} L${W},${H} L0,${H} Z` : d;
};

export default async function OpengraphImage() {
  const [sans, sansBold, mono] = await Promise.all([
    readFile(path.join(fonts, "geist-sans/Geist-Regular.ttf")),
    readFile(path.join(fonts, "geist-sans/Geist-SemiBold.ttf")),
    readFile(path.join(fonts, "geist-mono/GeistMono-Regular.ttf")),
  ]);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: bg, color: fg, fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px 0" }}>
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 20, letterSpacing: 4, color: muted }}>
          REACT · TANSTACK CHARTS
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 68, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
          Bklit UI&apos;s charts, now on TanStack.
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 28, gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Geist Mono",
              fontSize: 24,
              padding: "12px 20px",
              border: `1px solid ${border}`,
              borderRadius: 10,
              color: fg,
            }}
          >
            <span style={{ color: muted, marginRight: 14 }}>$</span>npm i bklit-tanstack-charts
          </div>
          <div style={{ display: "flex", fontSize: 24, color: muted }}>{allCharts.length} charts and utilities</div>
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", marginTop: "auto", height: H }}>
        <svg height={H} style={{ position: "absolute", left: 0, top: 0 }} viewBox={`0 0 ${W} ${H}`} width={W}>
          <defs>
            <linearGradient id="a" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={series[0]} stopOpacity="0.28" />
              <stop offset="1" stopColor={series[0]} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="b" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={series[1]} stopOpacity="0.32" />
              <stop offset="1" stopColor={series[1]} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} stroke={border} strokeDasharray="4 6" x1="0" x2={W} y1={H * f} y2={H * f} />
          ))}
          <path d={smooth(users, true)} fill="url(#a)" />
          <path d={smooth(views, true)} fill="url(#b)" />
          <path d={smooth(users, false)} fill="none" stroke={series[0]} strokeWidth="3" />
          <path d={smooth(views, false)} fill="none" stroke={series[1]} strokeWidth="3" />
        </svg>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: sans, weight: 400, style: "normal" },
        { name: "Geist", data: sansBold, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    }
  );
}
