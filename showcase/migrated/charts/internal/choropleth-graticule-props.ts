// Props for the <ChoroplethGraticule> carrier: owned here so the overlay imports downward.
interface ChoroplethGraticuleProps {
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly step?: [number, number];
}

export type { ChoroplethGraticuleProps };
