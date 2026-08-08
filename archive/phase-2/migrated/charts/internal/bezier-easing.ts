// bklit easing cubic-bezier(0.85, 0, 0.15, 1) as a JS easing fn for
// TanStack's scene animation (cubic bezier solved for progress; standard
// Newton-iteration implementation).
export function bezierEasing(p: number): number {
  const x1 = 0.85, y1 = 0, x2 = 0.15, y2 = 1;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const bx = (t: number) => 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
  const by = (t: number) => 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
  let t = p;
  for (let i = 0; i < 6; i++) {
    const err = bx(t) - p;
    if (Math.abs(err) < 1e-5) break;
    const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);
    if (dx === 0) break;
    t -= err / dx;
  }
  return by(t);
}
