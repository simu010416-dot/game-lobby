import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import type { AuthRequest } from '../middleware/auth.js';
import type { RoomManager } from '../services/room-manager.js';

const createRoomSchema = z.object({
  name: z.string().min(1).max(64),
  maxPlayers: z.number().int().min(2).max(12).optional(),
});

export function roomsRouter(db: Database, roomManager: RoomManager): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rooms = await roomManager.listRooms();
    res.json(rooms);
  });

  router.post('/', async (req: AuthRequest, res) => {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const room = await roomManager.createRoom({
      name: parsed.data.name,
      hostUserId: req.user.id,
      hostUsername: req.user.username,
      hostDisplayName: req.user.displayName,
      maxPlayers: parsed.data.maxPlayers ?? 8,
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
