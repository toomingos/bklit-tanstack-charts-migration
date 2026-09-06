interface SunburstNode {
  readonly name: string;
  readonly value?: number;
  readonly color?: string;
  readonly fill?: string;
  readonly children?: SunburstNode[];
}

interface ArcDatum {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly value: number;
  readonly categoryIndex: number;
  readonly hasChildren: boolean;
  readonly trail: string[];
  readonly parentId: string | null;
  a0: number;
  a1: number;
  arcIndex: number;
  readonly color?: string;
  readonly fill?: string;
}

interface Focus {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly parentId: string | null;
  readonly categoryIndex: number;
  a0: number;
  a1: number;
}

interface ArcGeometry {
  a0: number;
  a1: number;
  readonly innerR: number;
  readonly outerR: number;
}

export type { SunburstNode, ArcDatum, Focus, ArcGeometry };
