// V4.6 legacy port of charts/__tests__/chart-formatters.test.ts: none of
// hmsTimeFmt, intFmt, shortDateFmt, weekdayDateFmt is a barrel export (V3.7
// backlog). No public-export rewrite covers them, so every case is test.todo
// with the missing name. No assertions were weakened — nothing runs.
import { describe, test } from 'node:test';

describe('chart-formatters shortDateFmt', () => {
  test.todo('legacy/chart-formatters: shortDateFmt matches toLocaleDateString (missing export: shortDateFmt)');
});

describe('chart-formatters weekdayDateFmt', () => {
  test.todo('legacy/chart-formatters: weekdayDateFmt matches toLocaleDateString (missing export: weekdayDateFmt)');
});

describe('chart-formatters hmsTimeFmt', () => {
  test.todo('legacy/chart-formatters: hmsTimeFmt matches toLocaleTimeString (missing export: hmsTimeFmt)');
});

describe('chart-formatters intFmt', () => {
  test.todo('legacy/chart-formatters: intFmt matches toLocaleString (missing export: intFmt)');
  test.todo('legacy/chart-formatters: intFmt is a reusable formatter function (missing export: intFmt)');
});
