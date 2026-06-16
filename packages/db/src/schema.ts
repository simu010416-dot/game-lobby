import { pgTable, uuid, varchar, timestamp, text, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 64 }).notNull(),
  avatarColor: varchar('avatar_color', { length: 7 }).notNull().default('#6366f1'),
  isGuest: boolean('is_guest').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull(),
  hostUserId: uuid('host_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).notNull().default('waiting'),
  currentGame: varchar('current_game', { length: 32 }),
  queueMode: varchar('queue_mode', { length: 16 }).notNull().default('ordered'),
  maxPlayers: integer('max_players').notNull().default(8),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roomMembers = pgTable('room_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  username: varchar('username', { length: 32 }).notNull(),
  displayName: varchar('display_name', { length: 64 }).notNull(),
  isBot: boolean('is_bot').notNull().default(false),
  botDifficulty: varchar('bot_difficulty', { length: 16 }),
  role: varchar('role', { length: 16 }).notNull().default('player'),
  isOnline: boolean('is_online').notNull().default(true),
  isReady: boolean('is_ready').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roomGameQueue = pgTable('room_game_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  gameType: varchar('game_type', { length: 32 }).notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  gameType: varchar('game_type', { length: 32 }).notNull(),
  stateJson: text('state_json').notNull().default('{}'),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});
