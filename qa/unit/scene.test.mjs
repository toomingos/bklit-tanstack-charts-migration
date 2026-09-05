// V4.1 headless scene invariants: one representative static definition per
// migrated family, run through createChartScene + renderChartSvg with no DOM.
// Per family asserts: mark count, point count, materialized scale domains,
// and that every gradient/pattern/clip id in the svg is referenced by a
// fill/stroke (no orphaned defs). Expected values live in
// qa/unit/snapshots/<family>.json: written on first run, compared afterwards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scaleLinear as d3Linear, scalePoint } from 'd3-scale';
import { geoIdentity } from 'd3-geo';
import {
  INITIAL_WIDTH,
  createChartScene,
  defineChart,
  linearScale,
  renderChartSvg,
  svgUnreferencedIds,
  unitDir,
} from './lib/render.mjs';

const dist = (f) => import(`../../showcase/node_modules/@tanstack/charts/dist/${f}.js`);
const [{ lineY }, { areaY }, { barY, barX }, { dot }, { rect, cell }, { ruleY }, { link }] =
  await Promise.all(
    ['line', 'area', 'bar', 'dot', 'rect', 'rule', 'link'].map(dist),
  );
const { polar, radialArc, radialLine } = await dist('polar');
const { sunburst } = await dist('hierarchy-sunburst');
const { sankeyDiagram } = await dist('network-sankey');
const { geoShape } = await import('../../showcase/node_modules/@tanstack/charts/dist/geo.js');

const XY = { x: { scale: linearScale('x', [0, 3]) }, y: { scale: linearScale('y', [0, 30]) } };
const NULL_XY = { x: null, y: null };
const gradient = (id) => ({
  id,
  stops: [
    { offset: 0, color: '#0ea5e9' },
    { offset: 1, color: '#ffffff' },
  ],
});

// Representative data per family: small, fixed, shaped like the showcase demos.
const specs = {
  area: () =>
    defineChart({
      marks: [
        areaY(
          [
            { x: 0, y: 12 },
            { x: 1, y: 18 },
            { x: 2, y: 9 },
          ],
          { x: 'x', y: 'y', fill: 'url(#area-fill)' },
        ),
      ],
      scales: XY,
      gradients: [gradient('area-fill')],
    }),
  bar: () =>
    defineChart({
      marks: [
        barY(
          [
            { x: 'Jan', y: 12 },
            { x: 'Feb', y: 19 },
          ],
          { x: 'x', y: 'y' },
        ),
      ],
      scales: { x: { scale: linearScale('x', [0, 1]) }, y: XY.y },
    }),
  candlestick: () =>
    defineChart({
      marks: [
        rect(
          [
            { x: 0, o: 100, c: 104 },
            { x: 1, o: 104, c: 109 },
          ],
          { x: 'x', y: 'o', y1: 'c' },
        ),
        ruleY([{ h: 108 }, { h: 112 }], { y: 'h' }),
      ],
      scales: XY,
    }),
  choropleth: () =>
    defineChart({
      marks: [
        geoShape(
          [
            {
              type: 'Feature',
              properties: { name: 'a' },
              geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
            },
          ],
          { projection: { type: geoIdentity, fit: 'data' } },
        ),
      ],
      scales: NULL_XY,
    }),
  composed: () =>
    defineChart({
      marks: [
        barY([{ x: 'Jan', y: 46 }], { x: 'x', y: 'y' }),
        lineY(
          [
            { x: 0, y: 96 },
            { x: 1, y: 101 },
          ],
          { x: 'x', y: 'y' },
        ),
      ],
      scales: { x: { scale: linearScale('x', [0, 1]) }, y: XY.y },
    }),
  funnel: () =>
    defineChart({
      marks: [
        barX(
          [
            { s: 'Visitors', v: 124 },
            { s: 'Leads', v: 68 },
            { s: 'Closed', v: 12 },
          ],
          { y: 's', x: 'v' },
        ),
      ],
      scales: XY,
    }),
  gauge: () =>
    defineChart({
      marks: [
        polar({
          marks: [radialArc([{ a0: 0, a1: 4.2 }], { startAngle: 'a0', endAngle: 'a1' })],
          scales: { angle: null, radius: null },
          startAngle: -Math.PI / 2,
          endAngle: Math.PI / 2,
        }),
      ],
      scales: NULL_XY,
    }),
  heatmap: () =>
    defineChart({
      marks: [
        cell(
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 2 },
          ],
          { x: 'x', y: 'y' },
        ),
      ],
      scales: XY,
    }),
  line: () =>
    defineChart({
      marks: [
        lineY(
          [
            { x: 0, y: 1200 },
            { x: 1, y: 1350 },
            { x: 2, y: 1100 },
          ],
          { x: 'x', y: 'y' },
        ),
      ],
      scales: XY,
    }),
  'live-line': () =>
    defineChart({
      marks: [
        lineY(
          [
            { x: 0, y: 42.1 },
            { x: 1, y: 42.4 },
            { x: 2, y: 41.9 },
          ],
          { x: 'x', y: 'y' },
        ),
      ],
      scales: XY,
    }),
  pie: () =>
    defineChart({
      marks: [
        polar({
          marks: [
            radialArc(
              [
                { a0: 0, a1: 2.6 },
                { a0: 2.6, a1: 6.28 },
              ],
              { startAngle: 'a0', endAngle: 'a1' },
            ),
          ],
          scales: { angle: null, radius: null },
        }),
      ],
      scales: NULL_XY,
    }),
  radar: () =>
    defineChart({
      marks: [
        polar({
          marks: [
            radialLine(
              [
                { m: 'speed', v: 72 },
                { m: 'power', v: 85 },
                { m: 'range', v: 64 },
              ],
              { angle: 'm', radius: 'v' },
            ),
          ],
          scales: {
            angle: { scale: scalePoint().domain(['speed', 'power', 'range']) },
            radius: { scale: d3Linear().domain([0, 100]) },
          },
        }),
      ],
      scales: NULL_XY,
    }),
  ring: () =>
    defineChart({
      marks: [
        polar({
          marks: [
            radialArc([{ a0: 0, a1: 5.3 }], { startAngle: 'a0', endAngle: 'a1', innerRadius: 0.6 }),
          ],
          scales: { angle: null, radius: null },
        }),
      ],
      scales: NULL_XY,
    }),
  sankey: () =>
    defineChart({
      marks: [
        sankeyDiagram({
          nodes: [{ name: 'a' }, { name: 'b' }],
          links: [{ s: 'a', t: 'b', v: 5 }],
          nodeKey: 'name',
          source: 's',
          target: 't',
          value: 'v',
          marks: ({ nodes, links }) => [
            rect(nodes, { x: 'x0', x1: 'x1', y: 'y0', y1: 'y1' }),
            link(links, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' }),
          ],
        }),
      ],
      scales: NULL_XY,
    }),
  scatter: () =>
    defineChart({
      marks: [
        dot(
          [
            { x: 0, y: 140 },
            { x: 1, y: 230 },
          ],
          { x: 'x', y: 'y' },
        ),
      ],
      scales: XY,
    }),
  sunburst: () =>
    defineChart({
      marks: [
        polar({
          marks: [
            sunburst(
              [
                { id: 'root', parent: null, v: 0 },
                { id: 'a', parent: 'root', v: 52 },
                { id: 'b', parent: 'root', v: 38 },
              ],
              { nodeId: 'id', parentId: 'parent', value: 'v' },
            ),
          ],
          scales: { angle: null, radius: null },
        }),
      ],
      scales: NULL_XY,
    }),
};

const snapshotDir = join(unitDir, 'snapshots');

function summarize(family) {
  const scene = createChartScene(specs[family](), { width: INITIAL_WIDTH, height: 360 });
  const svg = renderChartSvg(scene, { ariaLabel: `${family} scene`, idPrefix: `qa-${family}` });
  const marksGroup = scene.nodes.find((n) => n.key === 'marks');
  return {
    marks: marksGroup?.children.length ?? 0,
    points: scene.points.length,
    domains: Object.fromEntries(
      Object.entries(scene.scales).map(([k, v]) => [k, v?.domain ?? null]),
    ),
    resourceIds: [...svg.matchAll(/<(linearGradient|radialGradient|pattern|clipPath)[^>]*\sid="([^"]+)"/g)].map(
      (m) => m[2],
    ),
    unreferenced: svgUnreferencedIds(svg),
  };
}

for (const family of Object.keys(specs)) {
  test(`scene/${family}: marks, points, domains, resource ids`, () => {
    const summary = JSON.parse(JSON.stringify(summarize(family)));
    assert.ok(summary.marks > 0, `expected ≥1 mark, got ${summary.marks}`);
    assert.ok(summary.points > 0, `expected ≥1 point, got ${summary.points}`);
    assert.deepStrictEqual(summary.unreferenced, [], 'orphaned gradient/pattern/clip ids');
    mkdirSync(snapshotDir, { recursive: true });
    const file = join(snapshotDir, `${family}.json`);
    if (!existsSync(file)) {
      writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);
      console.log(`wrote snapshot ${family}.json`);
      return;
    }
    assert.deepStrictEqual(summary, JSON.parse(readFileSync(file, 'utf8')), 'scene snapshot mismatch');
  });
}
