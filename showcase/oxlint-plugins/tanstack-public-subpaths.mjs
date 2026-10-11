// Public subpaths from the `exports` maps of @tanstack/charts@1.1.0 and @tanstack/react-charts@1.1.0.
// Regenerate on a TanStack bump: Object.keys(require("<pkg>/package.json").exports).
const CHARTS = "adapter adapter/renderer alpine angular area area-x arrow bar band box canvas crosshair cursor cursor/host d3/area-x d3/shape difference dom dodge dot export facet focus focus/guide focus/mark focus/disabled frame group geo hexagon hierarchy/tree hierarchy/treemap hierarchy/sunburst interaction/signal interaction/brush interaction/cursor interaction/handle interaction/zoom legend line link lit motion motion/definition network/force network/sankey octane octane/canvas octane/core mark/composite mark/decorative spring spatial/contour spatial/delaunay spatial/density spatial/hexbin spatial/voronoi svelte mark/scale-values polar preact react react/canvas react/core react/tooltip react-native react-native/tooltip universal reconcile rect regression selection renderer renderer/rect ridgeline rule runtime scales/band scales/linear scales/ordinal scales/point scene solid svg svg/renderer svg/resources stack transform transform/bin transform/bin-time transform/bin-xy transform/cumulative transform/fold transform/group transform/mosaic transform/normalize transform/rank transform/reduce transform/select transform/stack transform/waterfall transform/rolling-window text tick tooltip tooltip/model tooltip/portal types types/core vector violin view vue waffle".split(" ");
const REACT_CHARTS = ["canvas", "core", "tooltip"];

const group = (pkg, subpaths) => [`${pkg}/**`, ...subpaths.map((subpath) => `!${pkg}/${subpath}`)];

export default {
  group: [...group("@tanstack/charts", CHARTS), ...group("@tanstack/react-charts", REACT_CHARTS)],
};
