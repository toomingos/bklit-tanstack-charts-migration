// V4.1 DOM probes (P-22 roles, P-23 tab stops): renderToString every migrated
// family at initialWidth 640 and count the a11y surface. Targets (10 §1):
// exactly one role="img" per chart (V1.8), zero tab stops (legacy has zero
// tabIndex), aria-label present. D580 corrects the old note here: the single
// remaining tabindex is the package svg's own, identical across all 16 families —
// sunburst-center-overlay.tsx renders none in any state, and
// chart-marker-circle.tsx:138 no longer exists (D513).
// Families that fail a target today assert it as test.todo with today's value;
// V1.7 owns server rendering for the five useSyncExternalStore throwers, V1.8
// owns role="img"/ariaLabel forwarding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntry, countMatches, loadFresh } from './lib/render.mjs';

const { families, renderToString } = await loadFresh(bundleEntry('families.tsx'));

function probe(name) {
  try {
    const html = renderToString(families[name]());
    return {
      roleImg: countMatches(html, /role="img"/g),
      tabStops: countMatches(html, /tabindex/gi),
      ariaLabel: /aria-label=/.test(html),
    };
  } catch (e) {
    return { error: String(e?.message ?? e).split('\n')[0] };
  }
}

const SSR_NO_SNAPSHOT =
  'Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.';

// Measured 2026-09-05 (node --test, deterministic docs-data seeds); V1.7 mounts every
// family through ChartHost (funnel since V3.1, D545), so the package svg (role="img", one tab stop,
// aria-label) renders on the server for those ten too. V1.9 gave
// `usePrefersReducedMotion` a server snapshot, so no family throws now. The real
// test per family pins this object; the todos below pin the P-22/P-23 targets.
const TODAY = {
  area: { roleImg: 1, tabStops: 1, ariaLabel: true },
  bar: { roleImg: 1, tabStops: 1, ariaLabel: true },
  candlestick: { roleImg: 1, tabStops: 1, ariaLabel: true },
  choropleth: { roleImg: 1, tabStops: 1, ariaLabel: true },
  composed: { roleImg: 1, tabStops: 1, ariaLabel: true },
  funnel: { roleImg: 1, tabStops: 1, ariaLabel: true },
  gauge: { roleImg: 1, tabStops: 1, ariaLabel: true },
  heatmap: { roleImg: 1, tabStops: 1, ariaLabel: true },
  line: { roleImg: 1, tabStops: 1, ariaLabel: true },
  'live-line': { roleImg: 1, tabStops: 1, ariaLabel: true },
  pie: { roleImg: 1, tabStops: 1, ariaLabel: true },
  radar: { roleImg: 1, tabStops: 1, ariaLabel: true },
  ring: { roleImg: 1, tabStops: 1, ariaLabel: true },
  sankey: { roleImg: 1, tabStops: 1, ariaLabel: true },
  scatter: { roleImg: 1, tabStops: 1, ariaLabel: true },
  sunburst: { roleImg: 1, tabStops: 1, ariaLabel: true },
};

console.log(
  ['family roleImg tabStops ariaLabel', ...Object.entries(TODAY).map(([f, r]) => `${f} ${r.roleImg ?? '-'} ${r.tabStops ?? '-'} ${r.ariaLabel ?? 'throw'}`)].join('\n'),
);

for (const name of Object.keys(families)) {
  const today = TODAY[name];
  test(`probes/${name}: SSR probe matches today's record`, () => {
    assert.deepStrictEqual(probe(name), today);
  });
  const renders = !('error' in today);
  const oneImg = renders && today.roleImg === 1;
  (oneImg ? test : test.todo)(
    `probes/${name}: exactly one role="img" (P-22, V1.8; today ${renders ? today.roleImg : 'throw'})`,
    () => assert.strictEqual(probe(name).roleImg, 1),
  );
  const noTabs = renders && today.tabStops === 0;
  (noTabs ? test : test.todo)(
    `probes/${name}: zero tab stops (P-23; today ${renders ? today.tabStops : 'throw'}, remaining stop is the package svg's own — D580)`,
    () => assert.strictEqual(probe(name).tabStops, 0),
  );
  const labelled = renders && today.ariaLabel === true;
  (labelled ? test : test.todo)(`probes/${name}: aria-label present (today ${renders ? today.ariaLabel : 'throw'})`, () => {
    assert.strictEqual(probe(name).ariaLabel, true);
  });
}
