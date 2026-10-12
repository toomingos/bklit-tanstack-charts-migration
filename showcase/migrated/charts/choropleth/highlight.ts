// bklit's hovered-country highlight as a focus-guide mark: the dim is a CSS rule on the features group (styles.css), and this mark redraws the focused
// feature's own path node at opacity 1 in the `over` layer. Guide paints are written verbatim (UPSTREAM-GAPS #30), which resolveFill's url(#...) needs.
import { erase } from "../kit/erased-types";
import { createMark } from "@tanstack/charts";
import type { AnyMark } from "../kit/erased-types";
import { CROSSHAIR_CLASS } from "../kit/renderer-dom";

interface GeoNode {
  readonly kind: string;
  readonly key: string;
  readonly path?: string;
  readonly className?: string;
  readonly ariaHidden?: boolean;
  readonly style?: Readonly<Record<string, unknown>>;
  readonly children?: readonly GeoNode[];
}

const indexes = new WeakMap<object, Map<string, GeoNode>>();

const nodeIndex = (scene: { readonly nodes: readonly GeoNode[] }, prefix: string): Map<string, GeoNode> => {
  let index = indexes.get(scene);
  if (index) {return index;}
  index = new Map();
  const walk = (nodes: readonly GeoNode[]): void => {
    for (const node of nodes) {
      const children = node.kind === "group" ? node.children : undefined;
      if (children) {
        walk(children);
      }
      if (!children && node.key.startsWith(prefix) && node.path !== undefined) {
        index.set(node.key, node);
      }
    }
  };
  walk(scene.nodes);
  indexes.set(scene, index);
  return index;
};

interface HighlightInput {
  readonly focus?: { readonly primary?: { readonly markId?: string; readonly key?: string } };
  readonly scene: { readonly nodes: readonly GeoNode[] };
}

/** Focus-guide-only mark drawing the focused feature of the `markId` geoShape layer over the marks (snaps, like bklit's swap). */
export function featureHighlightMark(options: { readonly id: string; readonly markId: string }): AnyMark {
  const { id, markId } = options;
  const resolve = ({ focus, scene }: HighlightInput): GeoNode | undefined => {
    const point = focus?.primary;
    if (point?.markId !== markId || point.key === undefined) {
      return undefined;
    }
    const node = nodeIndex(scene, `${markId}:`).get(point.key);
    if (!node) {
      return undefined;
    }
    return {
      kind: "group",
      key: id,
      className: `${CROSSHAIR_CLASS} bkm-choro-highlight`,
      ariaHidden: true,
      children: [{ ...node, key: `${id}:feature`, style: { ...node.style, opacity: 1 } }],
    };
  };
  const mark = createMark(
    erase(() => ({
      id,
      focusGuideOnly: true,
      channels: {},
      render: erase(({ chart, surface }: { readonly chart: unknown; readonly surface: unknown }) => ({
        nodes: [],
        focusGuides: [{ key: id, markId: id, chart, surface, motion: false, resolve }],
      })),
    })),
    erase(false),
  );
  return erase(mark);
}
