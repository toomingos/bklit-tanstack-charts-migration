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
  private el: { readonly root: SVGSVGElement; readonly path: SVGPathElement } | null = null;
  private key: string | null = null;

  constructor(private readonly markId: string) {}

  /** Built on first client use: the highlight is created during render, which also runs on the server. */
  get root(): SVGSVGElement {
    return this.built().root;
  }

  private built(): { readonly root: SVGSVGElement; readonly path: SVGPathElement } {
    if (this.el) {return this.el;}
    const root = document.createElementNS(SVG_NS, "svg");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("class", "bkm-choro-hl");
    const layer = document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", "bkm-choro-hl-layer");
    const path = document.createElementNS(SVG_NS, "path");
    layer.append(path);
    root.append(layer);
    root.style.display = "none";
    this.el = { path, root };
    return this.el;
  }

  show(scene: Scene, key: string): void {
    this.key = key;
    this.write(scene);
  }

  hide(): void {
    this.key = null;
    if (this.el) {this.el.root.style.display = "none";}
  }

  refresh(scene: Scene): void {
    if (this.key !== null) {
      this.write(scene);
    }
  }

  private write(scene: Scene): void {
    const node = this.key === null ? undefined : nodeIndex(scene, `${this.markId}:`).get(this.key);
    const { path, root } = this.built();
    if (!node?.path) {
      root.style.display = "none";
      return;
    }
    path.setAttribute("d", node.path);
    const style = node.style ?? {};
    // style, not attributes: presentation attributes do not resolve var().
    path.style.fill = String(style.fill ?? "none");
    path.style.stroke = String(style.stroke ?? "none");
    path.style.strokeWidth = String(style.strokeWidth ?? 1);
    path.style.strokeLinejoin = "round";
    root.style.display = "";
  }
}
