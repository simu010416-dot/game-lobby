import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import type { Database } from '@game-lobby/db';
import { roomMembers, users } from '@game-lobby/db';

const DEFAULT_GUEST_USER_TTL_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60 * 60_000;

export async function sweepStaleGuestUsers(db: Database): Promise<{ deleted: number }> {
  const ttlMs = Number(process.env.GUEST_USER_TTL_MS) || DEFAULT_GUEST_USER_TTL_MS;
  const cutoff = new Date(Date.now() - ttlMs);

  const staleGuests = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isGuest, true), lt(users.createdAt, cutoff)));

  if (staleGuests.length === 0) return { deleted: 0 };

  const staleIds = staleGuests.map((g) => g.id);
  const onlineRows = await db
    .selectDistinct({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.isOnline, true),
        isNotNull(roomMembers.userId),
        inArray(roomMembers.userId, staleIds),
      ),
    );

  const onlineIds = new Set(
    onlineRows.map((r) => r.userId).filter((id): id is string => id != null),
  );
  const toDelete = staleIds.filter((id) => !onlineIds.has(id));

  if (toDelete.length === 0) return { deleted: 0 };

  await db.delete(users).where(inArray(users.id, toDelete));
  return { deleted: toDelete.length };
}

export function startGuestUserSweeper(db: Database): NodeJS.Timeout | undefined {
  if (process.env.GUEST_USER_SWEEP_ENABLED === 'false') return undefined;

  const intervalMs = Number(process.env.GUEST_USER_SWEEP_INTERVAL_MS) || DEFAULT_SWEEP_INTERVAL_MS;
  const onStart = process.env.GUEST_USER_SWEEP_ON_START !== 'false';

  const run = () => {
    sweepStaleGuestUsers(db)
      .then(({ deleted }) => {
        if (deleted > 0) {
          console.log(`[guest-user-sweep] removed ${deleted} stale guest account(s)`);
        }
      })
      .catch((err) => {
        console.error('[guest-user-sweep]', err);
      });
  };

  if (onStart) run();

  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
