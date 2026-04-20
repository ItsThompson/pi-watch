import type { ActivityStatus } from "@pi-watch/shared";
import { useActivityLog } from "../hooks/useActivityLog";
import { colors, ACTIVITY_COLORS } from "../theme/colors";

const MAX_VISIBLE = 10;

function entryLabel(event: { type: string; sessionId?: string }): string {
  const id = event.sessionId?.slice(0, 8) ?? "unknown";
  const action = event.type.replace("session:", "");
  return `${id} ${action}`;
}

function entryActivity(event: {
  type: string;
  activity?: ActivityStatus;
}): ActivityStatus {
  if (event.type === "session:removed") {return "idle";}
  return (event as { activity?: ActivityStatus }).activity ?? "idle";
}

export function ActivityLog() {
  const { entries } = useActivityLog();

  const visible = entries.slice(0, MAX_VISIBLE);

  if (visible.length === 0) {return null;}

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.borderDivider}`,
        padding: "6px 12px",
      }}
    >
      {visible.map((entry) => {
        const activity = entryActivity(entry.event);
        return (
          <div
            key={entry.id}
            style={{
              fontSize: 11,
              color: colors.textMuted,
              padding: "2px 0",
              display: "flex",
              gap: 6,
            }}
          >
            <span
              style={{ color: ACTIVITY_COLORS[activity], flexShrink: 0 }}
            >
              ●
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entryLabel(entry.event)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
