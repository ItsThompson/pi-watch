import { useEffect, useRef } from "react";
import { SessionList } from "./components/SessionList";
import { ActivityLog } from "./components/ActivityLog";

declare global {
  interface Window {
    piWatch?: {
      resizeMini: (height: number) => void;
      openSession: (id: string) => Promise<unknown>;
    };
  }
}

export function App() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) window.piWatch?.resizeMini(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-page text-primary">
      <div
        className="h-7 w-full"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div ref={contentRef}>
        <SessionList />
        <ActivityLog />
      </div>
    </div>
  );
}
