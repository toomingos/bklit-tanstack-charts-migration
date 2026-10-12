// bklit's hovered-country highlight (the focused feature's own path at opacity 1 over the dimmed features group) as an svg we own, a sibling of the renderer's
// svg inside the host. A native focus-guide mark re-serialized and reparsed the whole guide layer on every focus change, country path included (UPSTREAM-GAPS #66);
// here a focus change writes one `d` and a few paint properties. The dim itself is a CSS rule on the features group (styles.css).
const SVG_NS = "http://www.w3.org/2000/svg";

interface GeoNode {
  readonly kind: string;
  readonly key: string;
  readonly path?: string;
  readonly style?: Readonly<Record<string, unknown>>;
  readonly children?: readonly GeoNode[];
}

interface Scene {
  readonly nodes: readonly GeoNode[];
}

const indexes = new WeakMap<object, Map<string, GeoNode>>();

const nodeIndex = (scene: Scene, prefix: string): Map<string, GeoNode> => {
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

/** The highlight path of one choropleth host: `show` on a focused feature, `hide` off one, `refresh` after each render (a pan, zoom or resize moves the path). */
export class FeatureHighlight {
  readonly root: SVGSVGElement;
  private readonly path: SVGPathElement;
  private key: string | null = null;

  constructor(private readonly markId: string) {
    this.root = document.createElementNS(SVG_NS, "svg");
    this.root.setAttribute("aria-hidden", "true");
    this.root.setAttribute("class", "bkm-choro-hl");
    const layer = document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", "bkm-choro-hl-layer");
    this.path = document.createElementNS(SVG_NS, "path");
    layer.append(this.path);
    this.root.append(layer);
    this.root.style.display = "none";
  }

  show(scene: Scene, key: string): void {
    this.key = key;
    this.write(scene);
  }

  hide(): void {
    this.key = null;
    this.root.style.display = "none";
  }

  refresh(scene: Scene): void {
    if (this.key !== null) {
      this.write(scene);
    }
  }

  private write(scene: Scene): void {
    const node = this.key === null ? undefined : nodeIndex(scene, `${this.markId}:`).get(this.key);
    if (!node?.path) {
      this.root.style.display = "none";
      return;
    }
    const { path } = this;
    path.setAttribute("d", node.path);
    const style = node.style ?? {};
    // style, not attributes: presentation attributes do not resolve var().
    path.style.fill = String(style.fill ?? "none");
    path.style.stroke = String(style.stroke ?? "none");
    path.style.strokeWidth = String(style.strokeWidth ?? 1);
    path.style.strokeLinejoin = "round";
    this.root.style.display = "";
  }
}
