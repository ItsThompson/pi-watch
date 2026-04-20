import { useEffect, useRef } from "react";
import { SessionList } from "./components/SessionList";
import { ActivityLog } from "./components/ActivityLog";
import { colors } from "./theme/colors";

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
    if (!el || !window.piWatch?.resizeMini) return;

    const observer = new ResizeObserver(() => {
      window.piWatch!.resizeMini(el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        background: colors.backgroundPage,
        color: colors.textPrimary,
        fontFamily: "'Open Sans', sans-serif",
      }}
    >
      <div ref={contentRef}>
        <div
          style={
            {
              height: 28,
              WebkitAppRegion: "drag",
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
            } as React.CSSProperties
          }
        />
        <div style={{ padding: "28px 0" }}>
          <SessionList />
        </div>
        <ActivityLog />
      </div>
    </div>
  );
}
