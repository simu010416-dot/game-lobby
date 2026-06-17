import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createDb, createPgliteDb } from '@game-lobby/db';
import { authRouter } from './routes/auth.js';
import { roomsRouter } from './routes/rooms.js';
import { wordPacksRouter } from './routes/word-packs.js';
import { authMiddleware } from './middleware/auth.js';
import { setupSocketHandlers } from './socket/index.js';
import { RoomManager } from './services/room-manager.js';
import { startGuestUserSweeper } from './services/guest-user-service.js';
import { startWordPackSyncScheduler } from './services/word-pack-service.js';

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5273';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/game_lobby';

const usePglite =
  process.env.DB_DRIVER === 'pglite' || DATABASE_URL.startsWith('pglite');
const { db, pool } = usePglite ? await createPgliteDb() : createDb(DATABASE_URL);
const roomManager = new RoomManager(db);

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'game-lobby-server' });
});

app.use('/api/auth', authRouter(db));
app.use('/api/rooms', authMiddleware, roomsRouter(db, roomManager));
app.use('/api/word-packs', authMiddleware, wordPacksRouter(db));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

setupSocketHandlers(io, db, roomManager);
roomManager.startSweeper();
startGuestUserSweeper(db);
startWordPackSyncScheduler(db);

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
