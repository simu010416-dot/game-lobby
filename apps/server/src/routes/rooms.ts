import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import type { AuthRequest } from '../middleware/auth.js';
import type { RoomManager } from '../services/room-manager.js';
import { GAME_META } from '@game-lobby/shared';

const gameTypeSchema = z.enum(['undercover', 'da_vinci_code']);

const createRoomSchema = z.object({
  name: z.string().min(1).max(64),
  gameType: gameTypeSchema,
  maxPlayers: z.number().int().min(2).max(12).optional(),
});

export function roomsRouter(db: Database, roomManager: RoomManager): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = z.object({ gameType: gameTypeSchema.optional() }).safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }
    const rooms = await roomManager.listRooms(parsed.data.gameType);
    res.json(rooms);
  });

  router.post('/', async (req: AuthRequest, res) => {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const meta = GAME_META[parsed.data.gameType];
    const maxPlayers = parsed.data.maxPlayers ?? meta.maxPlayers;

    const room = await roomManager.createRoom({
      name: parsed.data.name,
      gameType: parsed.data.gameType,
      hostUserId: req.user.id,
      hostUsername: req.user.username,
      hostDisplayName: req.user.displayName,
      maxPlayers,
    });

    res.status(201).json(room);
  });

  router.get('/:roomId', async (req, res) => {
    const room = await roomManager.getRoomDetail(req.params.roomId!);
    if (!room) {
      res.status(404).json({ message: '房间不存在' });
      return;
    }
    res.json(room);
  });

  return router;
}
