import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  guessDaVinciTile,
  decideDaVinciContinue,
  placeDaVinciJoker,
  submitDaVinciSetup,
  type DaVinciGameState,
} from '@game-lobby/game-engine';

const davinciGuessSchema = z.object({
  targetPlayerId: z.string(),
  tileIndex: z.number().int().min(0),
  value: z.number().int().min(0).max(12),
});
const davinciDecisionSchema = z.object({ continue: z.boolean() });
const davinciPlaceSchema = z.object({ index: z.number().int().min(0) });
const davinciSetupSchema = z.object({
  tiles: z.array(
    z.object({
      color: z.enum(['black', 'white']),
      value: z.number().int().min(0).max(12),
      isJoker: z.boolean(),
    }),
  ),
});

export interface GameSocketDeps {
  roomManager: RoomManager;
  getRoomId: (socket: Socket) => string | null;
  findMember: (roomId: string, userId: string) => Promise<{ id: string } | undefined>;
  afterGameUpdate: (
    roomId: string,
    state: unknown,
    options?: { perPlayerState?: boolean },
  ) => Promise<void>;
}

export function registerDaVinciSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:davinci:guess', async (payload, cb) => {
    const parsed = davinciGuessSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return;

    game.state = guessDaVinciTile(
      game.state as DaVinciGameState,
      member.id,
      parsed.data.targetPlayerId,
      parsed.data.tileIndex,
      parsed.data.value,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });

  socket.on('game:davinci:decision', async (payload, cb) => {
    const parsed = davinciDecisionSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return;

    game.state = decideDaVinciContinue(
      game.state as DaVinciGameState,
      member.id,
      parsed.data.continue,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });

  socket.on('game:davinci:place', async (payload, cb) => {
    const parsed = davinciPlaceSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return;

    game.state = placeDaVinciJoker(
      game.state as DaVinciGameState,
      member.id,
      parsed.data.index,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });

  socket.on('game:davinci:setup', async (payload, cb) => {
    const parsed = davinciSetupSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return;

    game.state = submitDaVinciSetup(
      game.state as DaVinciGameState,
      member.id,
      parsed.data.tiles,
    );
    roomManager.touchGameRoom(roomId);

    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });
}
