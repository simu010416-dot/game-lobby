# New game scaffold — copy to packages/games/<id>/ and register in:
# - packages/shared (GameType, GAME_META)
# - packages/game-engine/src/registry.ts
# - apps/server/src/games/registry.ts
# - apps/web/src/games/registry.tsx

## Package layout

```
packages/games/<id>/
  package.json          # name: @game-lobby/game-<id>
  tsconfig.json
  vitest.config.ts
  src/
    logic.ts            # pure reducers
    module.ts           # GameModule implementation
    logic.test.ts
    index.ts
```

## module.ts checklist

- `create(participants, options)`
- `isEnded(state)` — usually `state.phase === 'ended'`
- `projectState?` — if clients need per-player redaction
- `runBotTurn?` — single bot action per call
- `preStartSpectatorIds?` — room prep before start
- `insufficientPlayersHint?` — min-player error suffix

## Server (apps/server/src/games/<id>/)

- `socket.ts` — `registerXxxSockets(socket, deps)`
- Register in `apps/server/src/games/registry.ts`

## Web (apps/web/src/games/<id>/)

- `<Id>Game.tsx`, optional `RoomSettings.tsx`, `socket.ts`, `index.ts`
- Register in `apps/web/src/games/registry.tsx`
