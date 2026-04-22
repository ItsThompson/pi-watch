import { useEffect, useRef, useState } from "react";
import type { ActivityStatus } from "@pi-watch/shared";
import { resolveSound, clearSession, playNotificationSound } from "./notifications";

export function useActivitySounds(): void {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const lastActivity = useRef(new Map<string, ActivityStatus>());

  // Subscribe to sound toggle from main process
  useEffect(() => {
    window.piWatch?.getSoundEnabled?.().then(setSoundEnabled);
    const cleanup = window.piWatch?.onSoundToggle?.(setSoundEnabled);
    return () => cleanup?.();
  }, []);

  // Listen to SSE events and play sounds
  useEffect(() => {
    const es = new EventSource("/api/events");

    const handleActivity = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (!soundEnabledRef.current) return;
      const sound = resolveSound(data.sessionId, data.activity, lastActivity.current);
      if (sound) playNotificationSound(sound);
    };

    const handleRemoved = (event: MessageEvent) => {
      const { sessionId } = JSON.parse(event.data);
      clearSession(sessionId, lastActivity.current);
    };

    es.addEventListener("session:added", handleActivity);
    es.addEventListener("session:updated", handleActivity);
    es.addEventListener("session:removed", handleRemoved);

    return () => es.close();
  }, []);
}
