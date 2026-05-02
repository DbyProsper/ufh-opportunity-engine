import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@/hooks/useDebounce";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Generic per-section autosave.
 *
 * - Debounces by `delay` ms (default 500).
 * - Skips the very first render so initial-load doesn't trigger a write.
 * - Exposes `status` for a "Saving…" / "Saved" indicator.
 */
export function useSectionAutoSave<T>(
  data: T,
  save: (value: T) => Promise<void>,
  delay = 500
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const isFirst = useRef(true);

  const debounced = useDebouncedCallback(async (value: T) => {
    setStatus("saving");
    try {
      await save(value);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      console.error("autosave failed", e);
      setStatus("error");
    }
  }, delay);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    debounced(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return status;
}