// Shared formatters (same output as bklit's chart-formatters).
export const shortDateFmt = /* @__PURE__ */ new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
export const weekdayDateFmt = /* @__PURE__ */ new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const intFormat = /* @__PURE__ */ new Intl.NumberFormat("en-US");
export const intFmt: Intl.NumberFormat["format"] = (value) => intFormat.format(value);
