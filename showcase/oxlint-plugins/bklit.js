/**
 * Local oxlint JS plugin: hazard rules for the bklit -> TanStack migration (AGENTS.md conventions).
 *
 * `bklit/no-ts-dom-reach-in` flags string literals that key on renderer-owned DOM (`ts-chart*`
 * classes, `data-ts-*` attributes). Nothing in TanStack's public API covers those hooks for
 * cartesian marks, so every use must cite the upstream gap that forces it.
 *
 * `bklit/timer-needs-citation` flags `setTimeout`, `setInterval` and `requestAnimationFrame`
 * calls with no nearby comment naming the bklit `file:line` or the gap they reproduce.
 */

const RENDERER_DOM = /\bts-chart[\w-]*|\bdata-ts-[\w-]*/u;
// `--ts-chart-*` custom properties are TanStack's documented theme hooks, not renderer DOM.
const THEME_CUSTOM_PROPERTY = /--ts-chart-[\w-]*/gu;
const GAP_CITATION = /#\d+|UPSTREAM-GAPS/u;
const BKLIT_CITATION = /[\w.-]+\.(?:tsx?|jsx?|mjs|css):\d+/u;
const TIMER_NAMES = new Set(["setTimeout", "setInterval", "requestAnimationFrame"]);
const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);
// How many lines above a node a citing comment may end and still count as "preceding" it.
const REACH_IN_WINDOW = 20;
const TIMER_WINDOW = 4;

/**
 * Finds a comment matching `pattern` that ends on the node's line or at most `window` lines above.
 *
 * @param {Array<object>} comments - All comments in the file.
 * @param {number} line - 1-based line of the node under test.
 * @param {number} window - Maximum distance in lines above the node.
 * @param {RegExp} pattern - Citation pattern the comment text must match.
 * @returns {boolean} Whether a citing comment is in range.
 */
const hasCitationAbove = (comments, line, window, pattern) =>
  comments.some(
    (comment) =>
      comment.loc.end.line <= line &&
      line - comment.loc.end.line <= window &&
      pattern.test(comment.value),
  );

const noTsDomReachIn = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Flags string literals that key on TanStack renderer-owned DOM unless a nearby comment cites an upstream gap.",
    },
    schema: [],
  },

  create(context) {
    const comments = context.sourceCode.getAllComments();
    const check = (node, text) => {
      const match = RENDERER_DOM.exec(text.replace(THEME_CUSTOM_PROPERTY, ""));
      if (!match) {return;}
      if (hasCitationAbove(comments, node.loc.start.line, REACH_IN_WINDOW, GAP_CITATION)) {return;}
      context.report({
        node,
        message:
          `"${match[0]}" keys on renderer-owned DOM. Prefer a native hook (className, states, motion); ` +
          "if none exists, add a comment above citing the gap (#NN or UPSTREAM-GAPS).",
      });
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") {check(node, node.value);}
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

/**
 * Resolves the called timer name for `setTimeout(...)` and `window.setTimeout(...)` shapes.
 *
 * @param {object} callee - CallExpression callee node.
 * @returns {string | undefined} The timer function name, if the call is a timer.
 */
const timerName = (callee) => {
  if (callee.type === "Identifier") {return TIMER_NAMES.has(callee.name) ? callee.name : undefined;}
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    GLOBAL_OBJECTS.has(callee.object.name) &&
    callee.property.type === "Identifier" &&
    TIMER_NAMES.has(callee.property.name)
  ) {
    return callee.property.name;
  }
  return undefined;
};

const timerNeedsCitation = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Requires timers and animation frames to cite the bklit file:line or gap number they reproduce.",
    },
    schema: [],
  },

  create(context) {
    const comments = context.sourceCode.getAllComments();
    return {
      CallExpression(node) {
        const name = timerName(node.callee);
        if (!name) {return;}
        const line = node.loc.start.line;
        if (
          hasCitationAbove(comments, line, TIMER_WINDOW, BKLIT_CITATION) ||
          hasCitationAbove(comments, line, TIMER_WINDOW, GAP_CITATION)
        ) {
          return;
        }
        context.report({
          node,
          message: `${name} needs a comment within ${TIMER_WINDOW} lines above citing the bklit file:line it reproduces (or a gap number).`,
        });
      },
    };
  },
};

export default {
  meta: { name: "bklit" },
  rules: {
    "no-ts-dom-reach-in": noTsDomReachIn,
    "timer-needs-citation": timerNeedsCitation,
  },
};
