import { useId } from "react";

export function useSanitizedId(): string {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}
