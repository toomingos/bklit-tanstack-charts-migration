"use client";

import { useState } from "react";

// Optional layers (V1.4): computers mount only for composed layers.
// Tree scan covers plain children; registry entries cover HOCs.
const sameElements = <Item,>(left: readonly Item[], right: readonly Item[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

// Returns the previous list while its elements are identical; registry props keep identity across no-op updates, so the wrapper array is the only churn.
const useStableList = <List extends readonly unknown[]>(list: List): List => {
  const [stable, setStable] = useState(list);
  if (stable !== list && !sameElements(stable, list)) {
    setStable(list);
    return list;
  }
  return stable;
};

export { useStableList };
