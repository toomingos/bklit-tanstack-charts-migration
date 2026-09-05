// Zoom context plus the memoised provider: the context value is a memo, never an inline object.
import { createContext, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import type { ProvidedZoom, ZoomState } from "./choropleth-zoom-types";

type ChoroplethZoomInstance<TElement extends Element> = ProvidedZoom<TElement> & ZoomState;

interface ChoroplethZoomContextValue {
  readonly zoom: ChoroplethZoomInstance<HTMLElement> | null;
}

const ChoroplethZoomContext = createContext<ChoroplethZoomContextValue>({ zoom: null });

const useChoroplethZoom = (): ChoroplethZoomContextValue => useContext(ChoroplethZoomContext);

interface ChoroplethZoomValueProps {
  readonly zoom: ChoroplethZoomInstance<HTMLElement>;
  readonly children: ReactNode;
}

const ChoroplethZoomValue = ({ zoom, children }: Readonly<ChoroplethZoomValueProps>): ReactElement => {
  const zoomValue = useMemo<ChoroplethZoomContextValue>(() => ({ zoom }), [zoom]);
  return <ChoroplethZoomContext.Provider value={zoomValue}>{children}</ChoroplethZoomContext.Provider>;
};

export { ChoroplethZoomContext, ChoroplethZoomValue, useChoroplethZoom };
export type { ChoroplethZoomContextValue, ChoroplethZoomInstance };
