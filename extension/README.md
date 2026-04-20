# pi-watch extension

Pi coding agent extension that reports session lifecycle, activity state, and tmux target to the pi-watch Electron app via HTTP heartbeats.

## Build

```bash
npm run build --workspace extension
```

Produces `dist/index.mjs`.

## Test

```bash
npm run test --workspace extension
```

## Manual smoke test

1. Start a netcat listener on port 8314:

   ```bash
   nc -lk 8314
   ```

2. In another terminal, run a throwaway node script that loads the built extension with a mock pi API:

   ```bash
   node --input-type=module <<'EOF'
   import { EventEmitter } from "node:events";
   const ext = await import("./extension/dist/index.mjs");
   const pi = {
     on: (event, handler) => {
       if (event === "session_start") {
         handler({}, { cwd: "/tmp", sessionManager: { getSessionId: () => "smoke-test" } });
       }
     },
     events: new EventEmitter(),
   };
   ext.default(pi);
   setTimeout(() => process.exit(0), 3000);
   EOF
   ```

3. Verify netcat receives a POST to `/api/sessions/register` with a JSON body containing `sessionId`, `pid`, `cwd`, `tmuxTarget`, and `startTime`.
