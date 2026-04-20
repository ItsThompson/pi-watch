import type { ActivityStatus } from "@pi-watch/shared";
import { useActivityLog } from "../hooks/useActivityLog";

const DOT_COLOR: Record<ActivityStatus, string> = {
  idle: "text-activity-idle",
  processing: "text-activity-processing",
  running_tool: "text-activity-running",
  pending_approval: "text-activity-pending",
};

function entryLabel(event: { type: string; sessionId?: string }): string {
  const id = event.sessionId?.slice(0, 8) ?? "unknown";
  const action = event.type.replace("session:", "");
  return `${id} ${action}`;
}

function entryActivity(event: {
  type: string;
  activity?: ActivityStatus;
}): ActivityStatus {
  if (event.type === "session:removed") return "idle";
  return (event as { activity?: ActivityStatus }).activity ?? "idle";
}

export function ActivityLog() {
  const { entries } = useActivityLog();

  if (entries.length === 0) return null;

  return (
    <ul className="space-y-0.5 px-2 pt-1 border-t border-divider">
      {entries.map((entry) => {
        const activity = entryActivity(entry.event);
        return (
          <li
            key={entry.id}
            className="flex items-center gap-2 text-xs text-muted"
          >
            <span className={DOT_COLOR[activity]}>●</span>
            <span className="truncate">{entryLabel(entry.event)}</span>
          </li>
        );
      })}
    </ul>
  );
}
