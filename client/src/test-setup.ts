import "@testing-library/jest-dom";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

export class MockEventSource {
  static instances: MockEventSource[] = [];
  readyState = 0;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  private listeners = new Map<string, Set<(e: MessageEvent) => void>>();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (
      this.listeners.get(type) ??
      this.listeners.set(type, new Set()).get(type)!
    ).add(cb);
  }
  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.get(type)?.delete(cb);
  }
  close() {
    this.readyState = 2;
  }

  // Test helpers:
  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((cb) => cb(event));
  }
  emitOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
}

(globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource =
  MockEventSource;
