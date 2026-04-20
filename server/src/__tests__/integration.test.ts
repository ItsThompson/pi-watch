import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { buildServer, createAppDeps } from "../server.js";
import type { FastifyInstance } from "fastify";

function connectSSE(port: number): Promise<{ messages: Array<{ event: string; data: string }>; req: http.ClientRequest }> {
  return new Promise((resolve) => {
    const messages: Array<{ event: string; data: string }> = [];
    const req = http.get(`http://127.0.0.1:${port}/api/events`, (res) => {
      let buffer = "";
      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;
        parts.forEach((part) => {
          const eventMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (eventMatch && dataMatch) {
            messages.push({ event: eventMatch[1], data: dataMatch[1] });
          }
        });
      });
      resolve({ messages, req });
    });
  });
}

async function postJSON(port: number, path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode!, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode!, body: raw });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

describe("Integration: full register → heartbeat → SSE → unregister flow", () => {
  let server: FastifyInstance;
  let port: number;
  let sseReq: http.ClientRequest | undefined;

  beforeEach(async () => {
    const deps = createAppDeps();
    const app = await buildServer(deps);
    server = app.server;
    await server.listen({ port: 0, host: "127.0.0.1" });
    const addr = server.server.address();
    port = typeof addr === "object" && addr ? addr.port : 0;
  });

  afterEach(async () => {
    sseReq?.destroy();
    await server.close();
  });

  it("register → heartbeat with activity change → SSE received → unregister → SSE removed", async () => {
    // open SSE connection
    const sse = await connectSSE(port);
    sseReq = sse.req;
    await new Promise((resolve) => setTimeout(resolve, 50));

    // register
    const regResult = await postJSON(port, "/api/sessions/register", {
      sessionId: "int-s1",
      pid: 9999,
      cwd: "/tmp/test",
      tmuxTarget: "main:0.0",
      startTime: "2026-01-01T00:00:00Z",
    });
    expect(regResult.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // verify SSE added
    const addedMsg = sse.messages.find((m) => m.event === "session:added");
    expect(addedMsg).toBeDefined();
    expect(JSON.parse(addedMsg!.data).sessionId).toBe("int-s1");

    // heartbeat with activity change
    await postJSON(port, "/api/sessions/heartbeat", {
      sessionId: "int-s1",
      activity: "processing",
      lastEventTime: "2026-01-01T00:01:00Z",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updatedMsg = sse.messages.find((m) => m.event === "session:updated");
    expect(updatedMsg).toBeDefined();
    expect(JSON.parse(updatedMsg!.data).activity).toBe("processing");

    // unregister
    await postJSON(port, "/api/sessions/unregister", { sessionId: "int-s1" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const removedMsg = sse.messages.find((m) => m.event === "session:removed");
    expect(removedMsg).toBeDefined();
    expect(JSON.parse(removedMsg!.data).sessionId).toBe("int-s1");

    // verify health endpoint still works
    const healthRes = await new Promise<string>((resolve) => {
      http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        let raw = "";
        res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
        res.on("end", () => resolve(raw));
      });
    });
    expect(JSON.parse(healthRes)).toEqual({ ok: true });
  });
});
