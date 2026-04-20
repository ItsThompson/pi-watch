import type { ActivityStatus } from "@pi-watch/shared";

export const colors = {
  backgroundPage: "#161d26",
  backgroundContainer: "#0f1b2a",
  textPrimary: "#d1d5db",
  textMuted: "#6b7280",
  borderDivider: "#2a2f38",
} as const;

export const ACTIVITY_COLORS: Record<ActivityStatus, string> = {
  idle: "#2ea043",
  processing: "#d29922",
  running_tool: "#58a6ff",
  pending_approval: "#f85149",
};
