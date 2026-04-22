# Pi-Watch: Activity Sound Alerts — Implementation Plan

## Overview

Add sound-only alerts to pi-watch that play when a session's `ActivityStatus` changes. Modeled after weaver's notification/sound system, adapted for pi-watch's simpler architecture and event model.

### Success Criteria

- A `chime` plays when any session transitions to `idle` (agent finished work).
- A `beep` plays when any session transitions to `processing` or `pending_approval`.
- Rapid `processing ↔ running_tool` flips are suppressed (no sound).
- Duplicate same-state events are deduplicated (no sound).
- A new session connecting (`session:added`) plays the sound for its initial activity.
- `session:removed` produces no sound and cleans up tracking state.
- Users can toggle sounds on/off via the tray menu.
- The toggle persists across app restarts via `PiWatchConfig`.

### Assumptions & Constraints

- No visual toast notifications: sound only.
- Sounds are generated programmatically via Web Audio API in the renderer process (same approach as weaver).
- Only two sounds needed: `beep` (short tone) and `chime` (two-note ascending).
- The tray toggle communicates to the renderer via Electron IPC + preload bridge, consistent with existing `resizeMini`/`openSession` patterns.
- The hook creates its own `EventSource` connection, consistent with how `useActivityLog` and `useSessions` each manage their own.

---

## Approach

### High-Level Design

The implementation adds three layers, each with a single responsibility:

1. **Sound generation** (`soundUtils.ts`): Pure utility that synthesizes WAV audio and exposes a `playNotificationSound()` function. Ported from weaver with only `beep` and `chime` retained.

2. **Transition resolution** (`resolveSound.ts`): Stateless function that takes a session ID, activity status, and a caller-owned `Map`, applies dedup and suppression rules, and returns which sound to play (or `null`). The function mutates the Map to track per-session state, but the caller controls the Map's lifecycle, keeping the function fully testable.

3. **SSE listener hook** (`useActivitySounds.ts`): React hook that connects to the SSE stream, feeds events through `resolveSound()`, and calls `playNotificationSound()` when the toggle is enabled.

The toggle flows from the main process (tray menu → config persistence) to the renderer (IPC → preload bridge → hook state).

```
┌─────────────────────────────────────────────────────────┐
│  Main Process (desktop)                                 │
│                                                         │
│  tray.ts ──toggle──► main.ts ──► saveConfig()           │
│                        │                                │
│                        │ pw:sound-toggled (IPC send)    │
│                        ▼                                │
│  preload.ts ──exposes──► window.piWatch.onSoundToggle() │
│              ──exposes──► window.piWatch.getSoundEnabled │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Renderer Process (client)                               │
│                                                          │
│  useActivitySounds()                                     │
│    ├── EventSource("/api/events")                        │
│    │     ├── session:added ──► resolveSound() ──► play() │
│    │     ├── session:updated ──► resolveSound() ──► play()│
│    │     └── session:removed ──► cleanup lastActivity    │
│    └── window.piWatch.getSoundEnabled() + onSoundToggle()│
│                                                          │
│  resolveSound(sessionId, activity, lastActivity)         │
│    ├── same state? → null                                │
│    ├── processing ↔ running_tool? → null                 │
│    └── idle → "chime" | others → "beep"                  │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Dedicated `EventSource` in `useActivitySounds` | Consistent with existing pattern: both `useSessions` and `useActivityLog` create their own. Avoids coupling to either hook's lifecycle. |
| `resolveSound()` returns a sound name, not a message string | Pi-watch has no visual notifications. Collapsing weaver's multi-layer pipeline (derive → resolve → map → play) into a single function is simpler and sufficient. |
| `lastActivity` passed as a `Map` parameter | Matches weaver's pattern. The caller owns the state, keeping `resolveSound` testable: tests control the Map, call the function, and assert on the return value. |
| Sound generation in renderer via Web Audio API | Identical to weaver. No native dependencies, works in Electron's Chromium renderer. |
| IPC bridge for toggle (not shared config file) | The renderer shouldn't read the filesystem. IPC + preload is the established cross-process communication pattern in pi-watch. |

### Alternative Approaches Considered

- **Sharing the `useSessions` EventSource**: Would avoid a third SSE connection but couples sound logic to session list rendering lifecycle. Rejected for separation of concerns.
- **Playing sounds in the main process**: Electron's main process can use native audio, but it adds complexity and differs from weaver's pattern. Web Audio in the renderer is simpler.

### Development Workflow

**Complexity: Moderate** (conditional business logic in `resolveSound`, touches 3 packages, IPC bridge, but low ambiguity since weaver provides a reference implementation).

**Levels: 1 + 2 + 3 (ATDD → BDD → TDD)**
- Level 1 (ATDD): Acceptance criteria are defined in the Success Criteria section above.
- Level 2 (BDD): Behavioral scenarios for `resolveSound` transition rules and `useActivitySounds` integration.
- Level 3 (TDD): Red-Green-Refactor for `resolveSound` (stateless function with specific algorithmic logic: dedup, suppression, mapping).

---

## Implementation Steps

### Step 1: Add `soundEnabled` to shared config type

Add the `soundEnabled` boolean to `PiWatchConfig` with a default of `true`.

**File**: `shared/src/types/config.ts`

```typescript
export interface PiWatchConfig {
  ghostMode: boolean;
  ghostOpacity: number;
  visible: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_CONFIG: PiWatchConfig = {
  ghostMode: false,
  ghostOpacity: 0.3,
  visible: true,
  soundEnabled: true,
};
```

**Depends on**: Nothing.

---

### Step 2: Create `soundUtils.ts`

Port weaver's sound generation utility, keeping only `beep` and `chime`. Remove dictation sounds entirely.

**File**: `client/src/hooks/notifications/soundUtils.ts`

Key exports:
- `NotificationSound` type: `"beep" | "chime"`
- `playNotificationSound(sound: NotificationSound): void`

Internals (ported verbatim from weaver):
- `generateTone()`: single-frequency exponential-decay tone
- `mixSamples()`: overlay multiple sample tracks
- `samplesToWavUrl()`: encode Float32Array → WAV blob URL

No test file: pure deterministic math producing audio bytes. Same decision as weaver. The important behavior (when to play) is tested in `resolveSound` and `useActivitySounds` tests.

**Depends on**: Nothing.

---

### Step 3: Create `resolveSound.ts` + tests (TDD)

Stateless function implementing transition dedup, suppression, and sound mapping. State is owned by the caller via the `lastActivity` Map parameter, which the function mutates to track per-session activity. This keeps the function fully testable: tests pass in a controlled Map and assert on the return value.

**Files**:
- `client/src/hooks/notifications/resolveSound.ts`
- `client/src/hooks/notifications/resolveSound.test.ts`

Signature:
```typescript
import type { ActivityStatus } from "@pi-watch/shared";
import type { NotificationSound } from "./soundUtils";

export function resolveSound(
  sessionId: string,
  activity: ActivityStatus,
  lastActivity: Map<string, ActivityStatus>,
): NotificationSound | null;
```

Logic:
1. Look up `prev = lastActivity.get(sessionId)`.
2. Set `lastActivity.set(sessionId, activity)`.
3. If `activity === prev` → return `null` (dedup).
4. If `(prev === "processing" && activity === "running_tool") || (prev === "running_tool" && activity === "processing")` → return `null` (suppression).
5. Return `ACTIVITY_SOUND[activity]` where the mapping is: `idle → "chime"`, all others → `"beep"`.

Also export a cleanup helper:
```typescript
export function clearSession(
  sessionId: string,
  lastActivity: Map<string, ActivityStatus>,
): void;
```

**TDD scenarios** (Red-Green-Refactor):

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | First event for session | `("s1", "idle", empty map)` | `"chime"` |
| 2 | First event: processing | `("s1", "processing", empty map)` | `"beep"` |
| 3 | First event: pending_approval | `("s1", "pending_approval", empty map)` | `"beep"` |
| 4 | Duplicate same state | idle then idle | `null` |
| 5 | Suppress processing → running_tool | processing then running_tool | `null` |
| 6 | Suppress running_tool → processing | running_tool then processing | `null` |
| 7 | Processing → idle | processing then idle | `"chime"` |
| 8 | Idle → processing | idle then processing | `"beep"` |
| 9 | Independent sessions | s1=idle, s2=idle | both produce `"chime"` |
| 10 | Full lifecycle | idle → processing → running_tool → processing → idle | `[chime, beep, null, null, chime]` |
| 11 | clearSession removes tracking | add s1, clear s1, re-add s1 | second add produces sound |

**Depends on**: Step 2 (imports `NotificationSound` type).

---

### Step 4: Create barrel export

**File**: `client/src/hooks/notifications/index.ts`

```typescript
export { resolveSound, clearSession } from "./resolveSound";
export { playNotificationSound, type NotificationSound } from "./soundUtils";
```

**Depends on**: Steps 2, 3.

---

### Step 5: Extend preload bridge

Add two new methods to the preload bridge for sound-enabled state.

**File**: `desktop/src/preload.ts`

Add:
- `getSoundEnabled: () => ipcRenderer.invoke("pw:get-sound-enabled")` — returns `Promise<boolean>`
- `onSoundToggle: (cb) => { ipcRenderer.on("pw:sound-toggled", handler); return cleanup }` — returns unsubscribe function

**File**: `client/src/App.tsx` (type declaration only)

Extend the `window.piWatch` type:
```typescript
declare global {
  interface Window {
    piWatch?: {
      resizeMini: (height: number) => void;
      openSession: (id: string) => Promise<unknown>;
      getSoundEnabled: () => Promise<boolean>;
      onSoundToggle: (cb: (enabled: boolean) => void) => () => void;
    };
  }
}
```

**Depends on**: Nothing (can be done in parallel with Steps 2-4).

---

### Step 6: Create `useActivitySounds` hook + tests

The main integration hook. Listens to SSE events, resolves sounds, respects the toggle.

**Files**:
- `client/src/hooks/useActivitySounds.ts`
- `client/src/hooks/useActivitySounds.test.ts`

```typescript
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

  // No return value: side-effect-only hook
}
```

The `soundEnabled` state is synced to a ref so the SSE event handler always reads the latest toggle value without the `EventSource` effect depending on it. This avoids tearing down and reconnecting the EventSource on every toggle, which would cause missed events during the reconnection gap.

**Test approach**: Use the existing `MockEventSource` from `test-setup.ts`. Mock `playNotificationSound` via `vi.mock`. Emit SSE events and assert which sounds were played (or not).

**BDD scenarios**:

| # | Given | When | Then |
|---|-------|------|------|
| 1 | Sound enabled, no prior events | `session:added` with `activity: "idle"` | `playNotificationSound("chime")` called |
| 2 | Sound enabled, session at "idle" | `session:updated` with `activity: "processing"` | `playNotificationSound("beep")` called |
| 3 | Sound enabled, session at "processing" | `session:updated` with `activity: "running_tool"` | No sound (suppressed) |
| 4 | Sound enabled, session at "processing" | `session:updated` with `activity: "idle"` | `playNotificationSound("chime")` called |
| 5 | Sound disabled | `session:updated` with activity change | No sound played |
| 6 | Sound enabled, session exists | `session:removed` | No sound, tracking cleaned up |
| 7 | No `window.piWatch` (browser dev mode) | Any SSE event with activity change | Sound plays (defaults to enabled) |

**Depends on**: Steps 3, 4, 5.

---

### Step 7: Update tray menu

Add a "Sound Alerts" checkbox to the tray menu.

**File**: `desktop/src/tray.ts`

Refactor `createTray` to accept a structured options object instead of positional parameters. The existing 4 parameters already follow a repeating `(callback, getter)` pair pattern; adding a third pair to reach 6 positional arguments of the same type is error-prone. This is the right time to refactor since the signature is already changing:

```typescript
export interface TrayMenuToggle {
  onToggle: () => boolean;
  isEnabled: () => boolean;
}

export interface TrayOptions {
  visibility: TrayMenuToggle;
  ghostMode: TrayMenuToggle;
  soundAlerts: TrayMenuToggle;
}

export function createTray(options: TrayOptions): void;
```

Add menu item after "Ghost Mode":
```typescript
{
  label: "Sound Alerts",
  type: "checkbox",
  checked: options.soundAlerts.isEnabled(),
  click: (menuItem) => {
    const nowEnabled = options.soundAlerts.onToggle();
    menuItem.checked = nowEnabled;
  },
},
```

Update existing "Show/Hide" and "Ghost Mode" items to use `options.visibility` and `options.ghostMode` respectively.

**Depends on**: Step 1 (config type).

---

### Step 8: Wire main process IPC + tray

Connect the tray toggle, config persistence, and IPC communication.

**File**: `desktop/src/main.ts`

Changes:
1. Add `ipcMain.handle("pw:get-sound-enabled")` that returns `currentConfig.soundEnabled`.
2. In the tray `onSoundToggle` callback:
   - Toggle `currentConfig.soundEnabled`
   - Call `saveConfig(configPath, currentConfig)`
   - Send `getMainWindow()?.webContents.send("pw:sound-toggled", currentConfig.soundEnabled)` to the renderer
   - Return the new value
3. Pass the sound toggle as `soundAlerts: { onToggle, isEnabled }` in the `TrayOptions` object to `createTray()`.

The `win` reference must be accessible. Export a getter from `window.ts`:

**File**: `desktop/src/window.ts`

Add:
```typescript
export function getMainWindow(): BrowserWindow | null {
  return win;
}
```

Then in `main.ts`, import and use `getMainWindow()` for IPC sends. This is explicit and safe: no assumption about window ordering or count.

Update the `createTray` call site to use the new options object:
```typescript
import { getMainWindow } from "./window.js";

createTray({
  visibility: {
    onToggle: toggleWindow,
    isEnabled: isWindowVisible,
  },
  ghostMode: {
    onToggle: () => {
      currentConfig.ghostMode = !currentConfig.ghostMode;
      setGhostMode(currentConfig.ghostMode, currentConfig.ghostOpacity);
      saveConfig(configPath, currentConfig);
      return currentConfig.ghostMode;
    },
    isEnabled: () => currentConfig.ghostMode,
  },
  soundAlerts: {
    onToggle: () => {
      currentConfig.soundEnabled = !currentConfig.soundEnabled;
      saveConfig(configPath, currentConfig);
      getMainWindow()?.webContents.send("pw:sound-toggled", currentConfig.soundEnabled);
      return currentConfig.soundEnabled;
    },
    isEnabled: () => currentConfig.soundEnabled,
  },
});
```

**Depends on**: Steps 1, 5, 7.

---

### Step 9: Mount hook in App

**File**: `client/src/App.tsx`

Add `useActivitySounds()` call inside the `App` component:
```typescript
import { useActivitySounds } from "./hooks/useActivitySounds";

export function App() {
  useActivitySounds();
  // ... rest of existing component
}
```

**Depends on**: Step 6.

---

### Step 10: Update test setup

**File**: `client/src/test-setup.ts`

Add a global `Audio` mock so `playNotificationSound` doesn't throw in jsdom:
```typescript
globalThis.Audio = class MockAudio {
  src = "";
  play() { return Promise.resolve(); }
} as unknown as typeof globalThis.Audio;
```

Also add `URL.createObjectURL` mock if not already present (jsdom may not support Blob URLs):
```typescript
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:mock";
}
```

**Depends on**: Nothing (can be done early).

---

## Files to Modify/Create

### New Files

| File | Description |
|------|-------------|
| `client/src/hooks/notifications/soundUtils.ts` | Tone generation + WAV encoding. `beep` and `chime` only. |
| `client/src/hooks/notifications/resolveSound.ts` | Activity transition → sound resolution with dedup + suppression. |
| `client/src/hooks/notifications/resolveSound.test.ts` | TDD tests for transition logic. |
| `client/src/hooks/notifications/index.ts` | Barrel exports. |
| `client/src/hooks/useActivitySounds.ts` | SSE listener hook that plays sounds on activity changes. |
| `client/src/hooks/useActivitySounds.test.ts` | BDD integration tests for the hook. |

### Modified Files

| File | Changes |
|------|---------|
| `shared/src/types/config.ts` | Add `soundEnabled: boolean` to `PiWatchConfig` and `DEFAULT_CONFIG`. |
| `client/src/App.tsx` | Extend `window.piWatch` type declaration. Mount `useActivitySounds()`. |
| `client/src/test-setup.ts` | Add `Audio` and `URL.createObjectURL` mocks. |
| `desktop/src/preload.ts` | Add `getSoundEnabled` and `onSoundToggle` to the preload bridge. |
| `desktop/src/tray.ts` | Add "Sound Alerts" checkbox. Refactor `createTray` from positional params to `TrayOptions` object. |
| `desktop/src/main.ts` | Wire IPC handlers, tray sound toggle, config persistence. Update `createTray` call site to use options object. |
| `desktop/src/window.ts` | Export `getMainWindow()` getter for IPC sends from `main.ts`. |

---

## Testing Strategy

### Development Workflow: Moderate → Levels 1 + 2 + 3

| Level | Applies to | Rationale |
|-------|-----------|-----------|
| **L1 — ATDD** | Whole feature | Acceptance criteria defined in Success Criteria above. Verified manually + via unit test coverage of each criterion. |
| **L2 — BDD** | `useActivitySounds` hook | Behavioral scenarios (Given/When/Then) for SSE events + sound toggle interaction. |
| **L3 — TDD** | `resolveSound` | Stateless function with specific algorithmic logic (dedup, suppression, mapping). Red-Green-Refactor is natural and high-value here. |

### Unit Tests

**`resolveSound.test.ts`** (TDD, 11 scenarios):
- First event per session → correct sound
- Duplicate same-state → null
- Processing ↔ running_tool suppression → null
- Activity transitions → correct sound
- Independent session tracking
- Full lifecycle sequence
- `clearSession` cleanup

**`useActivitySounds.test.ts`** (BDD, 7 scenarios):
- Sound plays on `session:added` with activity
- Sound plays on `session:updated` with activity change
- Suppressed transitions produce no sound
- No sound when toggle is disabled
- `session:removed` cleans up without sound
- Defaults to enabled when `window.piWatch` is absent

### Manual Testing

1. Start pi-watch desktop app.
2. Open a pi session in a terminal.
3. Verify `chime` on session connect.
4. Send a prompt. Verify `beep` when processing starts.
5. Verify no sound during tool execution flips.
6. Wait for agent to finish. Verify `chime` on idle.
7. Toggle "Sound Alerts" off in tray. Repeat steps 3-6. Verify silence.
8. Toggle back on. Verify sounds resume.
9. Quit and relaunch. Verify toggle state persisted.

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Third `EventSource` connection adds overhead | Low | Low | SSE is lightweight. Server already handles multiple connections from `useSessions` and `useActivityLog`. Monitor in dev tools if concerned. |
| Web Audio API blocked by Chromium autoplay policy | Low | Medium | Electron's renderer process doesn't enforce autoplay restrictions the same way browsers do. The `.catch(() => {})` on `play()` prevents crashes if it ever triggers. |
| `soundEnabled` config key missing in existing config files | Low | None | `loadConfig` merges with `DEFAULT_CONFIG`, so missing keys fall back to defaults. Existing users get `soundEnabled: true` automatically. |
| `BrowserWindow.getAllWindows()[0]` returns undefined | Low | Low | ~~Removed~~: replaced by explicit `getMainWindow()` getter exported from `window.ts`. No assumption about window ordering. |

### Rollback Strategy

All changes are additive. To rollback:
1. Remove `useActivitySounds()` from `App.tsx`.
2. Revert `soundEnabled` from config type (backward compatible: extra keys in JSON are ignored by `loadConfig`).
3. Remove tray menu item and IPC handlers.

---

## Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| `@pi-watch/shared` | Internal package | Config type change. No version bump needed (workspace reference). |
| Electron IPC (`ipcMain`, `ipcRenderer`) | Framework | Already used for `pw:resize` and `pw:open-session`. |
| Web Audio API (`AudioContext`, `Audio`) | Browser API | Available in Electron's Chromium renderer. No polyfill needed. |
| `vitest` + `@testing-library/react` | Dev dependency | Already installed in client package. |

No external dependencies, team approvals, or infrastructure changes required.
