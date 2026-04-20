interface SSEMessage {
  event: string;
  data: unknown;
}

type Listener = (msg: SSEMessage) => void;

export interface SSETarget {
  raw: {
    writeHead(statusCode: number, headers: Record<string, string>): void;
    write(chunk: string): boolean;
    on(event: string, listener: () => void): void;
  };
}

export function createEventBus() {
  const listeners = new Set<Listener>();

  return {
    emit(event: string, data: unknown): void {
      const msg: SSEMessage = { event, data };
      listeners.forEach((listener) => {
        try {
          listener(msg);
        } catch {
          /* swallow */
        }
      });
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    sseReply(reply: SSETarget): () => void {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      // flush headers so the client's response callback fires
      reply.raw.write(":\n\n");

      const unsubscribe = this.subscribe((msg) => {
        reply.raw.write(`event: ${msg.event}\ndata: ${JSON.stringify(msg.data)}\n\n`);
      });

      reply.raw.on("close", unsubscribe);
      return unsubscribe;
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
