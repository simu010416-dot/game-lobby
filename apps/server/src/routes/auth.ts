import { randomBytes } from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users, roomMembers, type Database } from '@game-lobby/db';
import { authMiddleware, signToken, type AuthRequest } from '../middleware/auth.js';
import { generateGuestDisplayName } from '../utils/guest-names.js';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(64),
  displayName: z.string().min(1).max(64).optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const guestLoginSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(64),
});

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];

function toUserResponse(user: {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  isGuest: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    isGuest: user.isGuest,
  };
}

export function authRouter(db: Database): Router {
  const router = Router();

  router.get('/guest/random-name', (_req, res) => {
    res.json({ displayName: generateGuestDisplayName() });
  });

  router.post('/guest', async (req, res) => {
    const parsed = guestLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const displayName = parsed.data.displayName?.trim() || generateGuestDisplayName();
    const username = `g_${randomBytes(8).toString('hex')}`;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;

    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        displayName,
        avatarColor,
        isGuest: true,
      })
      .returning();

    const profile = toUserResponse(user!);
    const token = signToken(profile);

    res.status(201).json({ token, user: profile });
  });

  router.patch('/profile', authMiddleware, async (req: AuthRequest, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const displayName = parsed.data.displayName.trim();
    const [user] = await db
      .update(users)
      .set({ displayName })
      .where(eq(users.id, req.user.id))
      .returning();

    if (!user) {
      res.status(404).json({ message: '用户不存在' });
      return;
    }

    await db
      .update(roomMembers)
      .set({ displayName })
      .where(eq(roomMembers.userId, user.id));

    const profile = toUserResponse(user);
    const token = signToken(profile);

    res.json({ token, user: profile });
  });

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const { username, password, displayName } = parsed.data;
    const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing) {
      res.status(409).json({ message: '用户名已存在' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;

    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        displayName: displayName ?? username,
        avatarColor,
        isGuest: false,
      })
      .returning();

    const profile = toUserResponse(user!);
    const token = signToken(profile);

    res.status(201).json({
      token,
      user: profile,
    });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const { username, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || user.isGuest || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: '用户名或密码错误' });
      return;
    }

    const profile = toUserResponse(user);
    const token = signToken(profile);

    res.json({
      token,
      user: profile,
    });
  });

  return router;
}
