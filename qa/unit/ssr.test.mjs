// V1.7 home: SSR fixture. Every migrated family server-renders through
// ChartHost at initialWidth 640 and emits a real <svg> with at least one
// package mark node inside it (the loading fallback is a <div>). Funnel
// mounts on marks with V3.1 (R2) and is asserted here only for the <svg>.
// Hydration adoption (09 invariant 4) is the todo below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntry, loadFresh } from './lib/render.mjs';

const { families, renderToString } = await loadFresh(bundleEntry('families.tsx'));

// Minimum svg markup per family, measured 2026-09-05 at V1.7 (0012eca) and
// rounded down to a floor: an item that shrinks one below its floor must
// say why in its D-entry and move the floor in the same commit.
const SVG_FLOOR = {
  area: 8000, bar: 4000, candlestick: 8000, choropleth: 100000, composed: 8000,
  funnel: 6000, gauge: 17000, heatmap: 25000, line: 4000, 'live-line': 8000,
  pie: 1000, radar: 10000, ring: 4000, sankey: 12000, scatter: 10000, sunburst: 20000,
};

for (const name of Object.keys(families)) {
  test(`ssr/${name}: renders a real <svg> at initialWidth 640 (floor ${SVG_FLOOR[name]} chars)`, () => {
    const html = renderToString(families[name]());
    const start = html.indexOf('<svg');
    assert.notStrictEqual(start, -1, 'no <svg> in server markup');
    const svg = html.slice(start, html.lastIndexOf('</svg>') + 6);
    assert.ok(svg.length >= SVG_FLOOR[name], `svg markup ${svg.length} chars < floor ${SVG_FLOOR[name]}`);
    assert.match(svg, /<(path|rect|circle|polygon|line|text)\b/, 'svg carries no drawn node');
  });
}

test.todo('ssr/hydration: client render adopts the server svg without a second mount (09 invariant 4)');
