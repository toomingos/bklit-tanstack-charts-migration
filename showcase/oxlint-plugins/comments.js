/**
 * Local oxlint JS plugin: comment length budget.
 *
 * `comments/max-lines` caps an explanatory comment at a small number of lines (default 2). Long
 * prose blocks in this repo have consistently drifted out of date with the code they describe, and
 * a comment that needs a paragraph is usually a signal that the code below it should be clearer.
 *
 * JSDoc blocks (`/** ... *\/`) are exempt on purpose: the enabled `jsdoc/require-param`,
 * `require-returns`, `require-param-type` and `require-returns-type` rules mandate them, and a rule
 * that fights another enabled rule just moves findings around instead of improving anything.
 */

const DEFAULT_MAX_LINES = 2;

const ADVICE =
  "Keep it concise and terse. First ask whether it is needed at all -- if the information can be " +
  "derived by reading the code, delete the comment instead of shortening it. If it is needed, " +
  "state only what the code cannot say: the why, the constraint, or the non-obvious consequence.";

/**
 * True when nothing but whitespace precedes the comment on its own line, i.e. it is a standalone
 * comment rather than a trailing one after code.
 *
 * @param {object} sourceCode - The oxlint/ESLint SourceCode object for the file.
 * @param {object} comment - The comment node under test.
 * @returns {boolean} Whether the comment starts its line.
 */
const startsItsOwnLine = (sourceCode, comment) => {
  const line = sourceCode.lines[comment.loc.start.line - 1] ?? "";
  return line.slice(0, comment.loc.start.column).trim() === "";
};

/**
 * Groups standalone `//` comments that occupy consecutive lines into single logical blocks, so a
 * wrapped three-line `//` paragraph counts as one three-line comment rather than three one-line ones.
 *
 * @param {ReadonlyArray<object>} comments - Standalone line comments in source order.
 * @returns {Array<Array<object>>} Runs of comments on consecutive lines.
 */
const groupConsecutiveLineComments = (comments) => {
  const runs = [];
  let current = [];
  for (const comment of comments) {
    const previous = current.at(-1);
    if (previous && comment.loc.start.line === previous.loc.end.line + 1) {
      current.push(comment);
      continue;
    }
    if (current.length > 0) {runs.push(current);}
    current = [comment];
  }
  if (current.length > 0) {runs.push(current);}
  return runs;
};

const maxLines = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Caps explanatory comments at a small number of lines to keep them terse and to discourage comments that restate the code.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 1 },
          ignoreJSDoc: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] ?? {};
    const max = options.max ?? DEFAULT_MAX_LINES;
    const ignoreJSDoc = options.ignoreJSDoc !== false;
    const sourceCode = context.sourceCode;

    return {
      Program() {
        const comments = sourceCode.getAllComments();
        const standalone = comments.filter((comment) => startsItsOwnLine(sourceCode, comment));

        for (const run of groupConsecutiveLineComments(standalone.filter((c) => c.type === "Line"))) {
          const lines = run.filter((comment) => comment.value.trim() !== "").length;
          if (lines <= max) {continue;}
          const first = run[0];
          context.report({
            message: `This comment is ${lines} lines; the budget is ${max}. ${ADVICE}`,
            loc: { start: first.loc.start, end: run.at(-1).loc.end },
          });
        }

        for (const comment of standalone) {
          if (comment.type !== "Block") {continue;}
          if (ignoreJSDoc && comment.value.startsWith("*")) {continue;}
          // Delimiter lines carry no prose, so the budget means the same in both comment styles.
          const lines = comment.value
            .split("\n")
            .map((line) => line.replace(/^\s*\*?/u, "").trim())
            .filter((line) => line !== "").length;
          if (lines <= max) {continue;}
          context.report({
            message: `This comment is ${lines} lines; the budget is ${max}. ${ADVICE}`,
            loc: { start: comment.loc.start, end: comment.loc.end },
          });
        }
      },
    };
  },
};

export default {
  meta: { name: "comments" },
  rules: { "max-lines": maxLines },
};
