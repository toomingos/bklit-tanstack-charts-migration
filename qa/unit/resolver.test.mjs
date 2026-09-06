// V2.1 home: mark-state resolver test. The pie dim states built by
// showcase/migrated/fixtures/states.check.ts resolve through the package's
// own resolver: the focused arc keeps its fill, every other arc dims.
// (Crosshair/nearest-point resolution is V2.5/V2.6's todo below.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntry, loadFresh, resolveMarkStateScene, sceneHasMarkStates } from './lib/render.mjs';

const { runStatesCheckWith, buildStatesCheckInput } = await loadFresh(bundleEntry('states.tsx'));
const resolver = {
  hasStates: (nodes) => sceneHasMarkStates(nodes),
  resolve: (scene, focus) => resolveMarkStateScene(scene, focus, null),
};

test('resolver/states: withStates puts mark states on the polar container', () => {
  assert.ok(sceneHasMarkStates(buildStatesCheckInput().scene.nodes));
});

test('resolver/states: focused arc keeps its fill, unmatched arcs resolve to the dim fill', () => {
  const line = runStatesCheckWith(resolver);
  assert.match(line, /focused arc keeps #0ea5e9, other resolves to color-mix\(/);
});

test.todo('resolver/crosshair: nearest-point and grouped-axis resolution (V2.5/V2.6)');
