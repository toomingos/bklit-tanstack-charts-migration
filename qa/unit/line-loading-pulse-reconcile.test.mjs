// SPIKE for the N2 verdict: can TanStack's own interpolator drive the line
// loading pulse clip window, with React owning only the cycle boundary?
// Runs the shipped 0.16.0 `dist/reconcile.js` (via `lib/render.mjs`
// `chartsDistUrl`, the same resolution the showcase bundles) plus the real
// migrated `pulseClipWindow` math and `bezierEasing`, headlessly in node.
// No preview/dev server, no gate harness (D588: the lead runs those serially).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundleEntry, chartsDistUrl, loadFresh } from './lib/render.mjs';

const {
  PULSE_CLIP_PADDING,
  PULSE_CYCLE_MS,
  PULSE_HALF_PROGRESS,
  pulseClipWindow,
  pulseExitSegments,
  pulseLoopProgressAt,
  pulseLoopSegments,
  bezierEasing,
} = await loadFresh(bundleEntry('pulse-window-spike.tsx'));

const { reconcileChartSvgFragment } = await import(chartsDistUrl('reconcile'));

// # ponytail: stub DOM covers only what dist/reconcile.js touches (template
// content parse, attribute r/w, sibling insert, rAF view). A real browser
// still owns HTML-parsing quirks; upgrade to jsdom if that gap ever matters.
class FakeElement {
  constructor(tag, doc) {
    this.localName = tag;
    this.namespaceURI = 'http://www.w3.org/2000/svg';
    this.ownerDocument = doc;
    this.attrs = new Map();
    this.kids = [];
    this.parent = null;
  }
  getAttributeNames() { return [...this.attrs.keys()]; }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  get children() { return this.kids; }
  get firstElementChild() { return this.kids.length > 0 ? this.kids[0] : null; }
  get nextElementSibling() {
    if (this.parent === null) return null;
    const siblings = this.parent.kids;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  get parentElement() { return this.parent; }
  get textContent() { return ''; }
  set textContent(_) { /* leaf text unused by this spike */ }
  insertBefore(node, ref) {
    if (node.parent !== null) node.remove();
    node.parent = this;
    const at = ref === null ? -1 : this.kids.indexOf(ref);
    if (at < 0) this.kids.push(node);
    else this.kids.splice(at, 0, node);
  }
  cloneNode(deep) {
    const copy = new FakeElement(this.localName, this.ownerDocument);
    for (const [k, v] of this.attrs) copy.attrs.set(k, v);
    if (deep) for (const kid of this.kids) copy.insertBefore(kid.cloneNode(true), null);
    return copy;
  }
  replaceWith(node) {
    if (this.parent === null) return;
    const at = this.parent.kids.indexOf(this);
    this.parent.kids.splice(at, 1, node);
    node.parent = this.parent;
    this.parent = null;
  }
  remove() {
    if (this.parent === null) return;
    this.parent.kids.splice(this.parent.kids.indexOf(this), 1);
    this.parent = null;
  }
}

// Test-subset markup parser: elements plus quoted attributes, self-closing or
// nested. Enough for the svg/clipPath/rect/path shapes in this spike.
function parseMarkup(doc, source) {
  const root = new FakeElement('fragment', doc);
  const stack = [root];
  const token = /<\/?[a-zA-Z][^<>]*>|[^<>]+/g;
  let match;
  while ((match = token.exec(source)) !== null) {
    const text = match[0];
    if (!text.startsWith('<')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    const selfClosing = text.endsWith('/>');
    const inner = text.slice(1, selfClosing ? -2 : -1).trim();
    const tag = inner.split(/\s+/, 1)[0];
    const element = new FakeElement(tag, doc);
    const attr = /([\w:.-]+)=(?:"([^"]*)"|'([^']*)')/g;
    let found;
    while ((found = attr.exec(inner)) !== null) {
      element.setAttribute(found[1], found[2] ?? found[3] ?? '');
    }
    stack[stack.length - 1].insertBefore(element, null);
    if (!selfClosing) stack.push(element);
  }
  return root;
}

// Document stub must exist before `createElement` closes over it.
function makeDoc(view) {
  const doc = {
    defaultView: view,
    createElement: (tag) => {
      const template = new FakeElement(tag, doc);
      let parsed = null;
      Object.defineProperty(template, 'innerHTML', { set: (v) => { parsed = parseMarkup(doc, v); } });
      Object.defineProperty(template, 'content', { get: () => ({ firstElementChild: parsed.firstElementChild }) });
      return template;
    },
  };
  return doc;
}

// Manually-stepped rAF: the spike controls time, so every asserted frame is exact.
function makeView() {
  const queue = new Map();
  let now = 0;
  let nextId = 1;
  return {
    requestAnimationFrame: (cb) => { const id = nextId; nextId += 1; queue.set(id, cb); return id; },
    cancelAnimationFrame: (id) => { queue.delete(id); },
    step: (ms) => {
      now += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb(now);
    },
    pending: () => queue.size,
  };
}

const INNER = 400;
const FULL = INNER + PULSE_CLIP_PADDING * 2;
const RIGHT = INNER + PULSE_CLIP_PADDING;

const rectMarkup = ({ x, width }) =>
  `<clipPath><rect data-ts-key="pulse" x="${x}" y="-10" width="${width}" height="70"/></clipPath>`;

const readRect = (clipRoot) => {
  const rect = clipRoot.firstElementChild;
  return { x: Number(rect.getAttribute('x')), width: Number(rect.getAttribute('width')) };
};

describe('line loading pulse reconcile spike (N2)', () => {
  it('window math matches bklit grow-then-shrink at sample points', () => {
    assert.deepEqual(pulseClipWindow(0, INNER), { width: 0, x: -PULSE_CLIP_PADDING });
    assert.deepEqual(pulseClipWindow(0.25, INNER), { width: FULL / 2, x: -PULSE_CLIP_PADDING });
    assert.deepEqual(pulseClipWindow(0.5, INNER), { width: FULL, x: -PULSE_CLIP_PADDING });
    assert.deepEqual(pulseClipWindow(0.75, INNER), { width: FULL / 2, x: RIGHT - FULL / 2 });
    assert.deepEqual(pulseClipWindow(1, INNER), { width: 0, x: RIGHT });
  });

  it('migrated ease transfers as a reconciler easing fn (0->0, 1->1, increasing)', () => {
    assert.equal(bezierEasing(0), 0);
    assert.equal(bezierEasing(1), 1);
    let prev = -Infinity;
    for (let i = 1; i < 10; i += 1) {
      const v = bezierEasing(i / 10);
      assert.ok(v > prev && v >= 0 && v <= 1, `easing must increase at ${i / 10}`);
      prev = v;
    }
  });

  // The falsifier that matters: bklit eases ONE progress value across the
  // whole cycle, so the only correct reference is
  // `pulseClipWindow(bezierEasing(t / PULSE_CYCLE_MS))` at wall time t --
  // never a per-half ease. Asserting the per-half curve instead is how the
  // first cut of this port shipped a clip ~7x too wide at t = cycle/4.
  const bklitWindowAt = (t) => pulseClipWindow(bezierEasing(t / PULSE_CYCLE_MS), INNER);

  it('every reconciled loop frame sits on the bklit whole-cycle curve', () => {
    const view = makeView();
    const doc = makeDoc(view);
    const [grow, shrink] = pulseLoopSegments(INNER);
    assert.equal(grow.durationMs, 1100);
    assert.equal(shrink.durationMs, 1100);

    // Grow half: current root parsed from markup, target via fragment string.
    const current = parseMarkup(doc, `<svg>${rectMarkup(grow.from)}</svg>`).firstElementChild.firstElementChild;
    const seen = [];
    const cancel = reconcileChartSvgFragment(current, rectMarkup(grow.to), {
      duration: grow.durationMs,
      easing: (p) => { seen.push(p); return grow.easing(p); },
    });
    view.step(0);
    assert.deepEqual(readRect(current), { x: grow.from.x, width: 0 });
    for (const at of [275, 550, 825, 1100]) {
      view.step(275);
      const { x, width } = readRect(current);
      const want = bklitWindowAt(at);
      assert.ok(Math.abs(width - want.width) < 0.002, `grow width off curve at ${at}ms: ${width} vs ${want.width}`);
      assert.equal(x, -PULSE_CLIP_PADDING);
    }
    assert.equal(view.pending(), 0);
    assert.deepEqual(readRect(current), { x: grow.to.x, width: FULL });
    assert.ok(seen.length > 2 && seen[0] === 0 && seen[seen.length - 1] === 1);
    cancel();

    // Shrink half continues from the grown state in the same root.
    const cancel2 = reconcileChartSvgFragment(current, rectMarkup(shrink.to), {
      duration: shrink.durationMs,
      easing: shrink.easing,
    });
    view.step(0);
    for (const at of [1375, 1650, 1925]) {
      view.step(275);
      const { x, width } = readRect(current);
      const want = bklitWindowAt(at);
      assert.ok(Math.abs(width - want.width) < 0.002, `shrink width off curve at ${at}ms`);
      assert.ok(Math.abs(x - want.x) < 0.002, `shrink x off curve at ${at}ms`);
    }
    view.step(275);
    view.step(1);
    assert.deepEqual(readRect(current), { x: RIGHT, width: 0 });
    cancel2();
  });

  it('a per-half ease would leave the bklit curve (regression guard)', () => {
    // Same instant, both readings: the plain ease is the defect, the composed
    // one is the port. If these ever agree, the guard has stopped guarding.
    const [grow] = pulseLoopSegments(INNER);
    const quarter = PULSE_CYCLE_MS / 4;
    const naive = bezierEasing(quarter / grow.durationMs) * FULL;
    const ported = grow.easing(quarter / grow.durationMs) * FULL;
    assert.ok(Math.abs(ported - bklitWindowAt(quarter).width) < 0.002, 'composed ease tracks bklit');
    assert.ok(naive > ported * 3, `per-half ease must diverge hard, got ${naive} vs ${ported}`);
  });

  it('exit resumes the pass in flight instead of restarting at zero width', () => {
    // Bklit reads the live progress and shortens the remaining legs
    // (`line-loading-pulse.tsx:112-134`); a restart would re-open at width 0.
    const midGrow = pulseLoopProgressAt(0, 550);
    assert.ok(midGrow > 0 && midGrow < PULSE_HALF_PROGRESS);
    const [growLeg, shrinkLeg] = pulseExitSegments(INNER, midGrow);
    assert.deepEqual(growLeg.from, pulseClipWindow(midGrow, INNER));
    assert.ok(growLeg.from.width > 0, 'exit must not restart at zero width');
    assert.ok(growLeg.durationMs < 1100, 'remaining grow leg is shortened');
    assert.deepEqual(shrinkLeg.to, { width: 0, x: RIGHT });

    const lateShrink = pulseLoopProgressAt(1, 825);
    assert.ok(lateShrink > PULSE_HALF_PROGRESS);
    const late = pulseExitSegments(INNER, lateShrink);
    assert.equal(late.length, 1, 'past the midpoint there is nothing left to grow');
    assert.ok(late[0].durationMs < 1100 && late[0].durationMs >= 10);
  });

  it('fragment cancel freezes the window mid-flight', () => {
    const view = makeView();
    const doc = makeDoc(view);
    const [grow] = pulseLoopSegments(INNER);
    const current = parseMarkup(doc, `<svg>${rectMarkup(grow.from)}</svg>`).firstElementChild.firstElementChild;
    const cancel = reconcileChartSvgFragment(current, rectMarkup(grow.to), {
      duration: grow.durationMs,
      easing: bezierEasing,
    });
    view.step(0);
    view.step(550);
    const frozen = readRect(current);
    assert.ok(frozen.width > 0 && frozen.width < FULL);
    cancel();
    view.step(5000);
    assert.deepEqual(readRect(current), frozen);
    assert.equal(view.pending(), 0);
  });
});
