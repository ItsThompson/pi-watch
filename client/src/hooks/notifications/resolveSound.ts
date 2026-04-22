import type { ActivityStatus } from "@pi-watch/shared";
import type { NotificationSound } from "./soundUtils";

const ACTIVITY_SOUND: Record<ActivityStatus, NotificationSound> = {
  idle: "chime",
  processing: "beep",
  running_tool: "beep",
  pending_approval: "beep",
};

const SUPPRESSED_PAIRS = new Set(["processing:running_tool", "running_tool:processing"]);

export function resolveSound(
  sessionId: string,
  activity: ActivityStatus,
  lastActivity: Map<string, ActivityStatus>,
): NotificationSound | null {
  const prev = lastActivity.get(sessionId);
  lastActivity.set(sessionId, activity);

  if (activity === prev) return null;
  if (prev !== undefined && SUPPRESSED_PAIRS.has(`${prev}:${activity}`)) return null;

  return ACTIVITY_SOUND[activity];
}

export function clearSession(
  sessionId: string,
  lastActivity: Map<string, ActivityStatus>,
): void {
  lastActivity.delete(sessionId);
}
