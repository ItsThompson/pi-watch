# pi-watch

A macOS menu bar application that surfaces every active pi coding session on the machine, shows per-session activity state (idle, processing, running tool, pending approval), and provides one-click tmux pane switching. Paired with a pi extension that reports session state via heartbeats.

## Prerequisites

- macOS
- Node.js >= 20
- tmux
- [Aerospace](https://github.com/nikitabobko/AeroSpace) (optional, for floating layout)

## Install and build

```bash
npm install
npm run build
```

## Install the pi extension

After building, symlink the extension into pi's extensions directory:

```bash
bash desktop/scripts/install-extension.sh
```

This creates `~/.pi/agent/extensions/pi-watch` → `<repo>/extension/dist`.

## Run

```bash
npm run app
```

This builds all packages and launches the Electron app. The Fastify server starts on `127.0.0.1:8314`.

## Aerospace configuration

If you use Aerospace, append the floating layout rules for pi-watch. A copy of the rules is in `scripts/aerospace-patch.toml`. After appending to `~/.config/aerospace/aerospace.toml`, reload:

```bash
aerospace reload-config
```

## Development

```bash
# Build a single package
npm run build --workspace server
npm run build --workspace client
npm run build --workspace extension
npm run build --workspace desktop

# Run tests
npm run test --workspace server
npm run test --workspace client
npm run test --workspace extension
npm run test --workspace desktop

# Run e2e tests (requires a built app)
npm run test --workspace e2e
```

## Manual QA checklist

1. Start pi-watch (`npm run app`).
2. Open a tmux session and start a pi coding session.
3. Verify the session appears in the overlay within 5 seconds.
4. Press F5 to toggle overlay visibility.
5. Enable Ghost Mode from the tray menu — overlay becomes translucent and click-through.
6. Click a session row to switch tmux to that pane.
7. Kill a pi process with `kill -9` — verify it disappears within 20 seconds.
8. Exit a pi session with Ctrl+D — verify it disappears immediately.
9. Quit pi-watch from the tray — verify running pi sessions are unaffected.
