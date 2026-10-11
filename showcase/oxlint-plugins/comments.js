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

/**
 * Single line/column position, matching the plugin API location shape.
 *
 * @typedef {object} LineColumn
 * @property {number} column - Zero-indexed column.
 * @property {number} line - One-indexed line.
 */

/**
 * Start/end span of a comment, matching the plugin API location shape.
 *
 * @typedef {object} CommentLoc
 * @property {LineColumn} end - End position.
 * @property {LineColumn} start - Start position.
 */

/**
 * Comment node, matching the plugin API comment shape.
 *
 * @typedef {object} PluginComment
 * @property {CommentLoc} loc - Span of the comment.
 * @property {"Block" | "Line" | "Shebang"} type - Comment kind.
 * @property {string} value - Comment text without delimiters.
 */

/**
 * Source-code handle, matching the plugin API source-code shape.
 *
 * @typedef {object} PluginSourceCode
 * @property {() => Array<PluginComment>} getAllComments - All comments in source order.
 * @property {Array<string>} lines - Source text split into lines.
 */

/**
 * Validated rule options for `comments/max-lines`.
 *
 * @typedef {object} MaxLinesOptions
 * @property {boolean} [ignoreJSDoc] - Skip JSDoc blocks.
 * @property {number} [max] - Budget of non-empty lines per comment.
 */

/**
 * Diagnostic payload accepted by the rule context report function.
 *
 * @typedef {object} MaxLinesReport
 * @property {CommentLoc} loc - Span to underline.
 * @property {string} message - Diagnostic text.
 */

/**
 * Rule context, matching the plugin API context shape.
 *
 * @typedef {object} MaxLinesContext
 * @property {ReadonlyArray<MaxLinesOptions | undefined>} options - Validated rule options.
 * @property {(diagnostic: MaxLinesReport) => void} report - Report a diagnostic.
 * @property {PluginSourceCode} sourceCode - Source-code handle for the file.
 */

/**
 * Visitor returned by the rule.
 *
 * @typedef {object} ProgramVisitor
 * @property {() => void} Program - Check every comment in the file.
 */

const DEFAULT_MAX_LINES = 2;

/** @type {MaxLinesOptions} */
const FALLBACK_OPTIONS = {};

const ADVICE =
  "Keep it concise and terse. First ask whether it is needed at all -- if the information can be " +
  "derived by reading the code, delete the comment instead of shortening it. If it is needed, " +
  "state only what the code cannot say: the why, the constraint, or the non-obvious consequence.";

/**
 * True when nothing but whitespace precedes the comment on its own line, i.e. it is a standalone
 * comment rather than a trailing one after code.
 *
 * @param {PluginSourceCode} sourceCode - The oxlint/ESLint SourceCode object for the file.
 * @param {PluginComment} comment - The comment node under test.
 * @returns {boolean} Whether the comment starts its line.
 */
const startsItsOwnLine = (sourceCode, comment) => {
  const preceding = sourceCode.lines.at(comment.loc.start.line - 1) ?? "";
  return preceding.slice(0, comment.loc.start.column).trim() === "";
};

/**
 * Groups standalone `//` comments that occupy consecutive lines into single logical blocks, so a
 * wrapped three-line `//` paragraph counts as one three-line comment rather than three one-line ones.
 *
 * @param {ReadonlyArray<PluginComment>} comments - Standalone line comments in source order.
 * @returns {Array<Array<PluginComment>>} Runs of comments on consecutive lines.
 */
const groupConsecutiveLineComments = (comments) => {
  /** @type {Array<Array<PluginComment>>} */
  const runs = [];
  /** @type {Array<PluginComment>} */
  let current = [];
  for (const comment of comments) {
    const previous = current.at(-1);
    if (previous === undefined) {
      current = [comment];
    } else if (comment.loc.start.line === previous.loc.end.line + 1) {
      current.push(comment);
    } else {
      runs.push(current);
      current = [comment];
    }
  }
  if (current.length > 0) {runs.push(current);}
  return runs;
};

const maxLines = {
  /**
   * @param {MaxLinesContext} context - The rule context for the file.
   * @returns {ProgramVisitor} Visitor reporting comments over budget.
   */
  create(context) {
    const { max = DEFAULT_MAX_LINES, ignoreJSDoc = true } = context.options[0] ?? FALLBACK_OPTIONS;
    const { sourceCode } = context;

    return {
      Program() {
        const comments = sourceCode.getAllComments();
        const standalone = comments.filter((comment) => startsItsOwnLine(sourceCode, comment));

        for (const run of groupConsecutiveLineComments(standalone.filter((lineComment) => lineComment.type === "Line"))) {
          const lineCount = run.filter((comment) => comment.value.trim() !== "").length;
          if (lineCount > max) {
            const [first] = run;
            const last = run.at(-1) ?? first;
            context.report({
              loc: { end: last.loc.end, start: first.loc.start },
              message: `This comment is ${lineCount} lines; the budget is ${max}. ${ADVICE}`,
            });
          }
        }

        for (const comment of standalone) {
          if (comment.type === "Block" && (!ignoreJSDoc || !comment.value.startsWith("*"))) {
            // Delimiter lines carry no prose, so the budget means the same in both comment styles.
            const lineCount = comment.value
              .split("\n")
              .map((line) => line.replace(/^\s*\*?/u, "").trim())
              .filter((line) => line !== "").length;
            if (lineCount > max) {
              context.report({
                loc: { end: comment.loc.end, start: comment.loc.start },
                message: `This comment is ${lineCount} lines; the budget is ${max}. ${ADVICE}`,
              });
            }
          }
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Caps explanatory comments at a small number of lines to keep them terse and to discourage comments that restate the code.",
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          ignoreJSDoc: { type: "boolean" },
          max: { minimum: 1, type: "integer" },
        },
        type: "object",
      },
    ],
    type: "suggestion",
  },
};

export default {
  meta: { name: "comments" },
  rules: { "max-lines": maxLines },
};
