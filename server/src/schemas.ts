import { z } from "zod/v4";

const activitySchema = z.enum(["idle", "processing", "running_tool", "pending_approval"]);

export const registerBodySchema = z.object({
  sessionId: z.string(),
  pid: z.number(),
  cwd: z.string(),
  tmuxTarget: z.string().nullable(),
  startTime: z.string(),
  agentName: z.string().optional(),
});

export const heartbeatBodySchema = z.object({
  sessionId: z.string(),
  activity: activitySchema,
  lastEventTime: z.string(),
  tmuxTarget: z.string().nullable().optional(),
});

export const unregisterBodySchema = z.object({
  sessionId: z.string(),
});

export const openTerminalBodySchema = z.object({
  sessionId: z.string(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;
export type UnregisterBody = z.infer<typeof unregisterBodySchema>;
