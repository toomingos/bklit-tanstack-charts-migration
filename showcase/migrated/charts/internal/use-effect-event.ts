"use client";
import { useCallback, useInsertionEffect, useRef } from "react";

// Next aliases "react" to its stable bundle without useEffectEvent; only unrelated experimental flags select the experimental channel.
// Local insertion-effect shim keeps a single runtime, so keep importing this hook from here instead of "react".

/**
 * Userland EffectEvent with insertion-effect refresh semantics.
 *
 * @param {(...args: TArgs) => TResult} callback - Latest closure to invoke.
 * @returns {(...args: TArgs) => TResult} Stable invoker reading the latest closure.
 */
export const useEffectEvent = <TArgs extends readonly unknown[], TResult>(
  callback: (...args: TArgs) => TResult,
): ((...args: TArgs) => TResult) => {
  const callbackRef = useRef(callback);
  useInsertionEffect(() => {
    callbackRef.current = callback;
  });
  const stableCallback = useCallback(
    (...args: TArgs): TResult => callbackRef.current(...args),
    [],
  );
  return stableCallback;
};
