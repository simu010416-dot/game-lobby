---
name: game-lobby-add-game
description: >-
  Adds or extends games in the game-lobby monorepo using Da Vinci Code as the
  reference implementation. Use when adding a new game under packages/games/,
  wiring game registries, implementing server socket handlers, building web UI
  modules, adding GameModule adapters, adding per-player state redaction, or
  introducing RoomSettings/start options like useJoker/assistMode.
disable-model-invocation: true
---

# Game Lobby: Add / Extend a Game (Da Vinci reference)

## When to use

Use this skill when you are asked to:

- Add a new game package under `packages/games/<id>/` (logic + module + tests).
- Wire a game into registries (`packages/shared`, `packages/game-engine`, server/web registries).
- Add game socket events (server + web emitters).
- Implement hidden information / anti-cheat with per-player redaction.
- Add game start options and room settings (Da Vinci’s `useJoker` / `assistMode` pattern).

## Quick workflow (copy-paste checklist)

### 1) Shared metadata

- [ ] Add `GameType` + `GAME_META` entry in `packages/shared/src/types.ts`.
- [ ] Set `minPlayers`, `maxPlayers`, `botsAllowed`.
- [ ] If the game has hidden info: set `requiresPerPlayerState: true`.

### 2) Game logic package

- [ ] Copy scaffold from `packages/games/_template/`.
- [ ] Implement pure reducers in `packages/games/<id>/src/logic.ts`.
- [ ] Implement `GameModule` adapter in `packages/games/<id>/src/module.ts`.
- [ ] Add tests in `packages/games/<id>/src/logic.test.ts`.
- [ ] Export public API in `packages/games/<id>/src/index.ts`.

### 3) Engine aggregation

- [ ] Register the module in `packages/game-engine/src/registry.ts`.
- [ ] Update exported unions / start-options map in `packages/game-engine/src/index.ts` (if applicable).

### 4) Server sockets

- [ ] Add `apps/server/src/games/<id>/socket.ts` with `registerXxxSockets(socket, deps)`.
- [ ] Validate payloads with Zod before calling reducers.
- [ ] After applying a reducer:
  - call `roomManager.touchGameRoom(roomId)`
  - if ended: `roomManager.markGameEnded(roomId)`
  - call `afterGameUpdate(roomId, game.state, { perPlayerState: <true|false> })`
- [ ] Register the sockets in `apps/server/src/games/registry.ts`.

### 5) Web module

- [ ] Add `apps/web/src/games/<id>/`:
  - `<Id>Game.tsx`
  - `socket.ts` (thin emit wrappers using `getActiveSocket()`)
  - optional `RoomSettings.tsx`
  - `index.ts` exports
- [ ] Register the game in `apps/web/src/games/registry.tsx` using a wrapper that injects emit callbacks as props.

### 6) Validation

- [ ] `pnpm test` and `pnpm typecheck` (and e2e if available).

## Core constraints (Da Vinci patterns)

- **Reducers must be pure**: reducers must not do I/O; invalid input should return the original state (no partial mutation).
- **`GameModule` is the only adapter**: keep `RoomManager` generic; do not add game-specific branches there.
- **Hidden information**:
  - implement `projectState(state, viewerId)` in `GameModule`
  - set `GAME_META.requiresPerPlayerState: true`
  - ensure server updates are emitted per socket/viewer (see `apps/server/src/socket/index.ts`)
  - in per-game socket handlers, use `afterGameUpdate(..., { perPlayerState: true })`
- **Socket event naming**: `game:<shortname>:<action>` (Da Vinci uses `game:davinci:*`).
- **Web UI decoupling**: the React component receives callbacks; it does not import socket.io directly.
- **Bots**: `runBotTurn` returns exactly one action per call; branch by stage/phase (see Da Vinci’s `guessing`/`deciding`/`placing`).

## Start options / Room settings (Da Vinci pattern)

If a game has start options:

- Web `RoomPage` keeps host-local state and passes options to `emitStartGame(...)`.
- Web socket layer attaches options to `game:start` only for that `gameType`.
- Server `game:start` handler branches per `gameType` and derives start options (Da Vinci defaults `useJoker=false`, `assistMode=true`).
- Logic package stores the options in game state at creation time (Da Vinci stores `useJoker` and `assistMode` in `DaVinciGameState`).

## Additional resources

- Implementation templates and file-to-file mapping: `reference.md`
- Da Vinci rules + state machine (including Joker/setup/assistMode): `da-vinci-rules.md`
