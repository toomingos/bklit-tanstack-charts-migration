// Layer compositor for a mark-level `renderer`: stacks the host renderer's layers and the mark layers in scene order (UPSTREAM-GAPS #51: only the Canvas module exports one).
// Covers what ring and sunburst use: no custom focus-guide renderers.
import type { ChartRenderer, ChartScene, ChartSurface, ChartSurfaceRenderOptions, RenderChartOptions, SceneNode } from "@tanstack/charts";

type Renderer = ChartRenderer<any, any, any>;
type Surface = ChartSurface<any, any, any>;
type Scene = ChartScene<any, any, any>;
interface Layer { renderer: Renderer; nodes: SceneNode[] }

const escapeAttribute = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Scene nodes grouped into consecutive runs by renderer; a group holding custom-rendered children is split, each run keeping the group wrapper. */
const splitLayers = (nodes: readonly SceneNode[], defaultRenderer: Renderer): { layers: Layer[]; custom: boolean } => {
  const layers: Layer[] = [];
  let custom = false;
  const append = (renderer: Renderer, next: SceneNode[]): void => {
    const previous = layers.at(-1);
    if (previous?.renderer === renderer) { previous.nodes.push(...next); } else { layers.push({ nodes: next, renderer }); }
  };
  for (const node of nodes) {
    if (node.renderer !== undefined) {
      const renderer = node.renderer as unknown as Renderer;
      custom ||= renderer !== defaultRenderer;
      append(renderer, [{ ...node, renderer: undefined }]);
    } else if (node.kind === "group") {
      const inner = splitLayers(node.children, defaultRenderer);
      if (inner.custom) {
        custom = true;
        for (const layer of inner.layers) { append(layer.renderer, [{ ...node, children: layer.nodes }]); }
      } else { append(defaultRenderer, [node]); }
    } else { append(defaultRenderer, [node]); }
  }
  return { custom, layers };
};

/** The host layer first and last, so the host's focus guides and hit surface sit on top of the custom layers. */
const renderLayers = (scene: Scene, defaultRenderer: Renderer): (Layer & { guides?: Scene["focusGuides"] })[] => {
  const layers: (Layer & { guides?: Scene["focusGuides"] })[] = splitLayers(scene.nodes, defaultRenderer).layers;
  if (layers[0]?.renderer !== defaultRenderer) { layers.unshift({ nodes: [], renderer: defaultRenderer }); }
  if (layers.at(-1)?.renderer !== defaultRenderer) { layers.push({ nodes: [], renderer: defaultRenderer }); }
  const top = layers.at(-1);
  if (top !== undefined && scene.focusGuides !== undefined && scene.focusGuides.length > 0) { top.guides = scene.focusGuides; }
  return layers;
};

const layerScene = (scene: Scene, layer: Layer & { guides?: Scene["focusGuides"] }, index: number): Scene => ({
  ...scene, focusGuides: layer.guides, nodes: layer.nodes, theme: index === 0 ? scene.theme : { ...scene.theme, background: "transparent" },
});

const layerOptions = (options: ChartSurfaceRenderOptions, index: number, animate: boolean): ChartSurfaceRenderOptions => ({
  ...options, animation: animate ? options.animation : undefined, className: undefined, idPrefix: `${options.idPrefix ?? "ts-chart"}-layer-${index}`, tabIndex: -1,
});

const LAYER_STYLE = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
const ROOT_STYLE = "display:block;position:relative;width:100%;height:100%;overflow:visible";

export const composeLayers = (defaultRenderer: Renderer): Renderer => {
  const renderer: Renderer = {
    capabilities: defaultRenderer.capabilities,
    id: `layers:${defaultRenderer.id}`,
    mount: (container, requestRender): Surface => {
      const root = container.querySelector<HTMLElement>(":scope > .ts-chart-layers") ?? container.ownerDocument.createElement("div");
      if (root.parentElement !== container) { container.replaceChildren(root); }
      const listeners = new Set<(points: never) => void>();
      let mounted: { renderer: Renderer; surface: Surface }[] = [];
      let rendered: Layer[] = [];
      let unsubscribe: (() => void) | undefined;
      let current: Scene | undefined;
      let destroyed = false;
      const defaultSurface = (): Surface | undefined => mounted.findLast((layer) => layer.renderer === defaultRenderer)?.surface;
      const mountAll = (layers: Layer[], adopt: boolean): void => {
        const existing = [...root.querySelectorAll<HTMLElement>(":scope > .ts-chart-layer")];
        const canAdopt = adopt && existing.length === layers.length;
        if (!canAdopt) { root.replaceChildren(); }
        mounted = layers.map((layer, index) => {
          let host = existing[index];
          if (!canAdopt || host === undefined) {
            host = container.ownerDocument.createElement("div");
            host.className = "ts-chart-layer";
            host.dataset.tsChartLayer = String(index);
            host.setAttribute("aria-hidden", "true");
            host.style.cssText = LAYER_STYLE;
            root.append(host);
          }
          return { renderer: layer.renderer, surface: layer.renderer.mount(host, requestRender) };
        });
      };
      const surface: Surface = {
        clientToScene: (scene, clientX, clientY) => {
          const bounds = root.getBoundingClientRect();
          return bounds.width === 0 || bounds.height === 0 ? null : { x: (clientX - bounds.left) / bounds.width * scene.width, y: (clientY - bounds.top) / bounds.height * scene.height };
        },
        destroy: (): void => {
          if (destroyed) { return; }
          destroyed = true;
          unsubscribe?.();
          listeners.clear();
          for (const layer of mounted) { layer.surface.destroy(); }
          mounted = [];
        },
        get defaultElement() { return defaultSurface()?.defaultElement ?? defaultSurface()?.element; },
        element: root,
        getPresentationPoints: () => defaultSurface()?.getPresentationPoints?.(),
        get layers() { return mounted.map((layer) => layer.surface); },
        paintFocus: (focus, pointer, cursor, options) => {
          if (current === undefined || destroyed) { return undefined; }
          const nodes: SceneNode[] = [];
          let presented = false;
          mounted.forEach((layer, index) => {
            const result = layer.surface.paintFocus(focus, pointer, cursor, options);
            presented ||= result !== undefined;
            nodes.push(...result?.nodes ?? rendered[index]?.nodes ?? []);
          });
          return presented ? { ...current, nodes } : undefined;
        },
        render: (scene, options): void => {
          if (destroyed) { return; }
          root.className = options.className === undefined ? "ts-chart ts-chart-layers" : `ts-chart ts-chart-layers ${options.className}`;
          root.setAttribute("role", "img");
          root.setAttribute("aria-roledescription", "chart");
          root.setAttribute("aria-label", options.ariaLabel);
          if (options.ariaDescription) { root.setAttribute("aria-description", options.ariaDescription); } else { root.removeAttribute("aria-description"); }
          root.tabIndex = options.tabIndex ?? 0;
          root.dataset.tsChartWidth = String(scene.width);
          root.dataset.tsChartHeight = String(scene.height);
          root.style.cssText = ROOT_STYLE;
          const next = renderLayers(scene, defaultRenderer);
          const reused = mounted.length === next.length && mounted.every((layer, index) => layer.renderer === next[index]?.renderer);
          if (!reused) {
            const adopt = mounted.length === 0;
            unsubscribe?.();
            for (const layer of mounted) { layer.surface.destroy(); }
            mountAll(next, adopt);
            unsubscribe = defaultSurface()?.subscribePresentationPoints?.((points) => { for (const listener of listeners) { listener(points as never); } });
          }
          mounted.forEach((layer, index) => { layer.surface.render(layerScene(scene, next[index] as Layer, index), layerOptions(options, index, reused)); });
          rendered = next;
          current = scene;
        },
        renderer,
        subscribePresentationPoints: (listener) => { listeners.add(listener); return (): void => { listeners.delete(listener); }; },
        get supportsStateFocus() { return mounted.every((layer) => layer.surface.supportsStateFocus) ? true as const : undefined; },
      };
      return surface;
    },
    prerender: (scene, options: RenderChartOptions): string => {
      const className = options.className ? `ts-chart ts-chart-layers ${options.className}` : "ts-chart ts-chart-layers";
      const description = options.ariaDescription ? ` aria-description="${escapeAttribute(options.ariaDescription)}"` : "";
      const layers = renderLayers(scene, defaultRenderer).map((layer, index) => {
        const inner = layer.renderer.prerender(layerScene(scene, layer, index), { ...options, className: undefined, idPrefix: `${options.idPrefix ?? "ts-chart"}-layer-${index}`, tabIndex: -1 });
        return `<div class="ts-chart-layer" data-ts-chart-layer="${index}" aria-hidden="true" style="${LAYER_STYLE}">${inner}</div>`;
      });
      return `<div class="${escapeAttribute(className)}" role="img" aria-roledescription="chart" aria-label="${escapeAttribute(options.ariaLabel)}"${description} tabindex="${options.tabIndex ?? 0}" data-ts-chart-width="${Math.round(scene.width)}" data-ts-chart-height="${Math.round(scene.height)}" style="${ROOT_STYLE}">${layers.join("")}</div>`;
    },
  };
  return renderer;
};
