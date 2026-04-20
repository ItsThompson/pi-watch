import type { RegisteredSession, ActivityStatus } from "@pi-watch/shared";

type ChangeKind = "added" | "updated" | "removed";
type ChangeListener = (kind: ChangeKind, entry: RegisteredSession) => void;

interface RegistryOptions {
  now: () => number;
  expiryMs: number;
}

export function createSessionRegistry(options: RegistryOptions) {
  const entries = new Map<string, RegisteredSession>();
  const listeners = new Set<ChangeListener>();

  const emit = (kind: ChangeKind, entry: RegisteredSession) => {
    listeners.forEach((listener) => {
      try {
        listener(kind, entry);
      } catch {
        /* prevent one broken listener from blocking others */
      }
    });
  };

  return {
    register(entry: RegisteredSession): void {
      const stored = { ...entry, lastSeen: new Date(options.now()).toISOString() };
      entries.set(entry.sessionId, stored);
      emit("added", stored);
    },


    heartbeat(payload: {
      sessionId: string;
      activity: ActivityStatus;
      lastEventTime: string;
      tmuxTarget?: string | null;
      agentName?: string;
    }): void {
      const existing = entries.get(payload.sessionId);
      if (!existing) {
        const newEntry: RegisteredSession = {
          sessionId: payload.sessionId,
          pid: 0,
          cwd: "",
          tmuxTarget: payload.tmuxTarget ?? null,
          startTime: new Date(options.now()).toISOString(),
          activity: payload.activity,
          lastSeen: new Date(options.now()).toISOString(),
          lastEventTime: payload.lastEventTime,
          agentName: payload.agentName,
        };
        entries.set(payload.sessionId, newEntry);
        emit("added", newEntry);
        return;
      }

      const activityChanged = existing.activity !== payload.activity;
      existing.lastSeen = new Date(options.now()).toISOString();
      existing.lastEventTime = payload.lastEventTime;
      existing.activity = payload.activity;
      if (payload.tmuxTarget !== undefined) {
        existing.tmuxTarget = payload.tmuxTarget ?? null;
      }
      if (payload.agentName !== undefined) {
        existing.agentName = payload.agentName;
      }

      if (activityChanged) {
        emit("updated", existing);
      }
    },

    unregister(sessionId: string): void {
      const entry = entries.get(sessionId);
      if (!entry) return;
      entries.delete(sessionId);
      emit("removed", entry);
    },

    reap(now: number): void {
      const expired = [...entries.values()].filter(
        (entry) => now - new Date(entry.lastSeen).getTime() > options.expiryMs,
      );
      expired.forEach((entry) => {
        entries.delete(entry.sessionId);
        emit("removed", entry);
      });
    },

    list(): readonly RegisteredSession[] {
      return [...entries.values()].sort(
        (a, b) =>
          new Date(b.lastEventTime).getTime() -
          new Date(a.lastEventTime).getTime(),
      );
    },

    get(sessionId: string): RegisteredSession | undefined {
      return entries.get(sessionId);
    },

    onChange(listener: ChangeListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SessionRegistry = ReturnType<typeof createSessionRegistry>;
