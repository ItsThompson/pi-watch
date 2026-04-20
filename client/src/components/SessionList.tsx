import type { RegisteredSession } from "@pi-watch/shared";
import { MAX_VISIBLE_SESSIONS } from "@pi-watch/shared";
import { useSessions } from "../hooks/useSessions";
import { colors, ACTIVITY_COLORS } from "../theme/colors";

function displayName(session: RegisteredSession): string {
  return (
    session.agentName ||
    session.cwd.split("/").pop() ||
    session.sessionId.slice(0, 8)
  );
}

export function SessionList() {
  const { sessions, isLoading } = useSessions();

  if (isLoading) {return null;}

  const sorted = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.lastEventTime).getTime() -
        new Date(a.lastEventTime).getTime(),
    )
    .slice(0, MAX_VISIBLE_SESSIONS);

  if (sorted.length === 0) {
    return (
      <div
        style={{
          padding: "16px 12px",
          fontSize: 13,
          color: colors.textMuted,
        }}
      >
        No open sessions
      </div>
    );
  }

  const handleClick = (sessionId: string) => {
    if (window.piWatch?.openSession) {
      window.piWatch.openSession(sessionId).catch(() => {});
    } else {
      fetch("/api/open-terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  };

  return (
    <div>
      {sorted.map((session) => (
        <div
          key={session.sessionId}
          onClick={() => handleClick(session.sessionId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <span style={{ color: ACTIVITY_COLORS[session.activity] }}>●</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName(session)}
          </span>
        </div>
      ))}
    </div>
  );
}
