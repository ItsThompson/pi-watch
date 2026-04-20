import type { SessionRegistry } from "./session-registry.js";

interface ReaperOptions {
  registry: SessionRegistry;
  intervalMs: number;
  now: () => number;
}

export function createReaper(options: ReaperOptions) {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start(): void {
      timer = setInterval(() => {
        options.registry.reap(options.now());
      }, options.intervalMs);
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
