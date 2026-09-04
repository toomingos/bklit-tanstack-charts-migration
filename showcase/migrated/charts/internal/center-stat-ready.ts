import { useEffect, useState } from "react";

/**
 * Presence probe for the `customElements` DOM global; property access on `globalThis`
 * avoids the `ReferenceError` a bare reference throws during SSR.
 * @param {Candidate} registry The global registry, absent outside a DOM environment.
 * @returns {boolean} Whether the custom-elements registry is defined.
 */
const isCustomElementsDefined = <Candidate,>(registry: Candidate): registry is Candidate & CustomElementRegistry =>
  registry !== undefined;

/** Gates `<NumberFlow>` behind `customElements.whenDefined`; static `Intl` fallback pre-hydration.
 * @returns {boolean} Whether the animated number element is registered and ready to mount.
 */
const useNumberFlowElementReady = (): boolean => {
  const [ready, setReady] = useState(
    () => isCustomElementsDefined(globalThis.customElements) &&
      Boolean(globalThis.customElements.get("number-flow-react")),
  );

  useEffect((): (() => void) | undefined => {
    if (ready) {return undefined;}
    let cancelled = false;
    const markReadyWhenDefined = async (): Promise<void> => {
      try {
        await customElements.whenDefined("number-flow-react");
      } catch {
        // Invalid element name — the static Intl fallback stays mounted.
        return;
      }
      if (!cancelled) {setReady(true);}
    };
    // Fire-and-forget by design: the effect's cancellation flag above guards the late resolve.
    void markReadyWhenDefined();
    return (): void => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

export {
  useNumberFlowElementReady,
};
