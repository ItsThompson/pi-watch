import type { ActivityStatus } from "@pi-watch/shared";
import { MAX_VISIBLE_SESSIONS } from "@pi-watch/shared";
import { useSessions } from "../hooks/useSessions";

const DOT_COLOR: Record<ActivityStatus, string> = {
  idle: "text-activity-idle",
  processing: "text-activity-processing",
  running_tool: "text-activity-running",
  pending_approval: "text-activity-pending",
};

function displayName(cwd: string, sessionId: string): string {
  return cwd.split("/").pop() || sessionId.slice(0, 8);
}

export function SessionList() {
  const { sessions, isLoading } = useSessions();

  if (isLoading) return null;

  if (sessions.length === 0) {
    return <p className="text-muted text-sm px-3 py-2">No open sessions</p>;
  }

  const sorted = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.lastEventTime).getTime() -
        new Date(a.lastEventTime).getTime(),
    )
    .slice(0, MAX_VISIBLE_SESSIONS);

  const handleClick = (sessionId: string) => {
    fetch("/api/open-terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  };

  return (
    <ul className="space-y-1 px-2">
      {sorted.map((session) => (
        <li key={session.sessionId}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-primary hover:bg-divider"
            onClick={() => handleClick(session.sessionId)}
          >
            <span className={DOT_COLOR[session.activity]}>●</span>
            <span className="truncate">
              {displayName(session.cwd, session.sessionId)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
