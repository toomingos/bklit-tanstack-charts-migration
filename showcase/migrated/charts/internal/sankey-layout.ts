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

export type { LaidOutNode, LaidOutLink };
export { SANKEY_LABEL_OFFSET, SANKEY_VALUE_LABEL_GAP };
