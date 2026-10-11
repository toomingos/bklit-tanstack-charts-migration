export interface SankeyNodeDatum {
  readonly name: string;
  readonly category?: "source" | "landing" | "outcome";
  readonly [key: string]: unknown;
}

export interface SankeyLinkDatum {
  readonly source: number;
  target: number;
  readonly value: number;
  readonly [key: string]: unknown;
}

export interface SankeyData {
  readonly nodes: SankeyNodeDatum[];
  readonly links: SankeyLinkDatum[];
}

export interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

// Consumer-callback shapes (mirror d3-sankey rows as bklit exposes them).
export interface SankeyPropNode {
  readonly name: string;
  readonly index?: number | undefined;
  readonly value?: number | undefined;
  readonly x0?: number | undefined;
  readonly y0?: number | undefined;
  readonly x1?: number | undefined;
  readonly y1?: number | undefined;
  readonly [key: string]: unknown;
}

export interface SankeyPropLink {
  readonly source: number;
  readonly target: number;
  readonly value: number;
  readonly y0?: number | undefined;
  readonly y1?: number | undefined;
  readonly width?: number | undefined;
  readonly index?: number | undefined;
  readonly [key: string]: unknown;
}
