import { useRef } from "react";
import { sameValue } from "./guards";

type Rows = readonly Readonly<Record<string, unknown>>[];

export const sameRows = (a: Rows, b: Rows): boolean =>
  a === b || (a.length === b.length && a.every((row, i) => {
    const other = b[i];
    const keys = Object.keys(row);
    return keys.length === Object.keys(other).length && keys.every((key) => sameValue(row[key], other[key]));
  }));

/** True once `data` differs in content from the first data rendered. Builders use it to tell a later update (bklit snaps everything, guides included) from the entrance (guides fade in);
 * an equal re-created array stays false. Compared once per array identity. */
export const useDataUpdated = (data: Rows): boolean => {
  const first = useRef(data);
  const seen = useRef<{ data: Rows; updated: boolean }>({ data, updated: false });
  if (seen.current.data !== data) {
    seen.current = { data, updated: seen.current.updated || !sameRows(first.current, data) };
  }
  return seen.current.updated;
};
