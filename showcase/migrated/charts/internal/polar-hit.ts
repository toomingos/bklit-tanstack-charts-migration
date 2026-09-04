// App-owned polar hit-test on static geometry: native focus misses during data
// Transitions caused an unhover/rebuild loop; angles use d3 convention (0 at 12, CW).

interface PolarHitBand {
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

const TWO_PI = Math.PI * 2;

const angleFrom = (dx: number, dy: number, startAngle: number): number => {
  let angle = Math.atan2(dx, -dy);
  while (angle < startAngle) {angle += TWO_PI;}
  while (angle >= startAngle + TWO_PI) {angle -= TWO_PI;}
  return angle;
}

interface BandHitParams {
  readonly band: Readonly<PolarHitBand>;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
}

const bandMatchesHit = (params: Readonly<BandHitParams>): boolean => {
  if (params.radius < params.band.innerRadius || params.radius > params.band.outerRadius) {return false;}
  if (params.band.endAngle <= params.band.startAngle) {return false;}
  const angle = angleFrom(params.x, params.y, params.band.startAngle);
  return angle < params.band.endAngle;
}

// Last band wins, matching the old topmost-hitbox rule on overlap.
const hitTestPolarBands = (x: number, y: number, bands: readonly PolarHitBand[]): number | null => {
  const radius = Math.hypot(x, y);
  let hit: number | null = null;
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands.at(i);
    if (band !== undefined && bandMatchesHit({ band, radius, x, y })) {hit = i;}
  }
  return hit;
}

interface CenterOffset {
  readonly x: number;
  readonly y: number;
}

const pointerToCenterOffset = (el: Element, clientX: number, clientY: number): CenterOffset => {
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}

export type { PolarHitBand };
export { hitTestPolarBands, pointerToCenterOffset };
