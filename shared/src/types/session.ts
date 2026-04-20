export type ActivityStatus =
  | "idle"
  | "processing"
  | "running_tool"
  | "pending_approval";

export interface RegisteredSession {
  sessionId: string;
  pid: number;
  cwd: string;
  tmuxTarget: string | null;
  startTime: string;
  activity: ActivityStatus;
  lastSeen: string;
  lastEventTime: string;
  agentName?: string;
}

export interface HeartbeatPayload {
  sessionId: string;
  activity: ActivityStatus;
  lastEventTime: string;
  tmuxTarget?: string | null;
  agentName?: string;
}

export type SSEEvent =
  | { type: "session:added"; session: RegisteredSession }
  | { type: "session:updated"; session: RegisteredSession }
  | { type: "session:removed"; session: { sessionId: string } };
