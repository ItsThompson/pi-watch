import { useEffect, useRef, useState, useCallback } from "react";
import type { SSEEvent } from "@pi-watch/shared";
import { MAX_ACTIVITY_LOG_ENTRIES } from "@pi-watch/shared";

const DISMISS_MS = 4000;

export interface ActivityLogEntry {
  id: string;
  event: SSEEvent;
  timestamp: number;
}

export function useActivityLog(): { entries: ActivityLogEntry[] } {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    const timers: ReturnType<typeof setTimeout>[] = [];

    const handle = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      const sseEvent = { type: event.type, ...data } as SSEEvent;
      const id = String(nextId.current++);

      setEntries((prev) =>
        [...prev, { id, event: sseEvent, timestamp: Date.now() }].slice(
          -MAX_ACTIVITY_LOG_ENTRIES,
        ),
      );

      timers.push(setTimeout(() => dismiss(id), DISMISS_MS));
    };

    es.addEventListener("session:added", handle);
    es.addEventListener("session:updated", handle);
    es.addEventListener("session:removed", handle);

    return () => {
      es.close();
      timers.forEach(clearTimeout);
    };
  }, [dismiss]);

  return { entries };
}
