import useSWR from "swr";
import { useEffect, useCallback } from "react";
import type { RegisteredSession, SSEEvent } from "@pi-watch/shared";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSessions(): {
  sessions: RegisteredSession[];
  isLoading: boolean;
} {
  const { data, isLoading, mutate } = useSWR<RegisteredSession[]>(
    "/api/sessions",
    fetcher,
  );

  const handleEvent = useCallback(
    (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as SSEEvent["session"];
      const eventType = event.type as SSEEvent["type"];

      mutate((current) => {
        const list = current ?? [];
        if (eventType === "session:added") {
          const session = payload as RegisteredSession;
          if (list.some((s) => s.sessionId === session.sessionId)) return list;
          return [...list, session];
        }
        if (eventType === "session:updated") {
          const session = payload as RegisteredSession;
          return list.map((s) =>
            s.sessionId === session.sessionId ? session : s,
          );
        }
        if (eventType === "session:removed") {
          const { sessionId } = payload as { sessionId: string };
          return list.filter((s) => s.sessionId !== sessionId);
        }
        return list;
      }, false);
    },
    [mutate],
  );

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("session:added", handleEvent);
    es.addEventListener("session:updated", handleEvent);
    es.addEventListener("session:removed", handleEvent);

    es.onopen = () => {
      mutate();
    };

    return () => es.close();
  }, [handleEvent, mutate]);

  return { sessions: data ?? [], isLoading };
}
