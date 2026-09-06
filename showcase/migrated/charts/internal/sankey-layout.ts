// Laid-out shapes this entry reads (package rows carry the layout).
interface LaidOutNode {
  readonly name?: string;
  readonly category?: string;
  readonly index: number;
  readonly value?: number;
  readonly x0?: number;
  readonly y0?: number;
  readonly x1?: number;
  readonly y1?: number;
}

/**
 * Minimal consumer-callback node shape: the fields of d3-sankey's
 * `SankeyNode` a callback can observe (name plus optional layout scalars),
 * so legacy d3-typed `getNodeColor`/`nodeContent` callbacks stay mutually
 * assignable without depending on d3-sankey (V3.2 deleted it).
 */
interface SankeyPropNode {
  readonly name: string;
  readonly index?: number | undefined;
  readonly value?: number | undefined;
  readonly x0?: number | undefined;
  readonly y0?: number | undefined;
  readonly x1?: number | undefined;
  readonly y1?: number | undefined;
  readonly [key: string]: unknown;
}

/**
 * Minimal consumer-callback link shape: mirrors d3-sankey's `SankeyLink`
 * required fields, so `getLinkColor`/`getLinkPattern`/`linkContent`
 * callbacks stay mutually assignable without d3-sankey.
 */
interface SankeyPropLink {
  readonly source: number;
  readonly target: number;
  readonly value: number;
  readonly y0?: number | undefined;
  readonly y1?: number | undefined;
  readonly width?: number | undefined;
  readonly index?: number | undefined;
  readonly [key: string]: unknown;
}

interface LaidOutLink {
  readonly sourceIndex: number;
  readonly targetIndex: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  width: number;
}

const SANKEY_LABEL_OFFSET = 12;
const SANKEY_VALUE_LABEL_GAP = 16;

export type { LaidOutNode, LaidOutLink, SankeyPropLink, SankeyPropNode };
export { SANKEY_LABEL_OFFSET, SANKEY_VALUE_LABEL_GAP };
