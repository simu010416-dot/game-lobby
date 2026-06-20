export type GameType =
  | 'undercover'
  | 'da_vinci_code'
  | 'draw_guess'
  | 'act_guess'
  | 'german_heart_attack'
  | 'werewolf'
  | 'gomoku'
  | 'go'
  | 'chess'
  | 'script_murder'
  | 'dwarf_mine'
  | 'chinese_chess';

export type AiDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export type PlayerRole = 'host' | 'player' | 'spectator';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  isGuest?: boolean;
}

export interface RoomPlayer {
  id: string;
  userId: string | null;
  username: string;
  displayName: string;
  isBot: boolean;
  botDifficulty: AiDifficulty | null;
  role: PlayerRole;
  isOnline: boolean;
  isReady: boolean;
}

export interface RoomSummary {
  id: string;
  name: string;
  hostId: string;
  gameType: GameType;
  status: RoomStatus;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  players: RoomPlayer[];
  createdAt: string;
}

export interface RoomDetail extends RoomSummary {
  activePlayerIds: string[];
  spectatorIds: string[];
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface GameMetaEntry {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  botsAllowed: boolean;
  requiresPerPlayerState: boolean;
  hasWordPacks?: boolean;
  hasPairPacks?: boolean;
  hasScripts?: boolean;
}

export const GAME_META: Record<GameType, GameMetaEntry> = {
  undercover: {
    name: '谁是卧底',
    minPlayers: 4,
    maxPlayers: 12,
    description: '平民与卧底轮流描述词语，投票找出卧底。',
    botsAllowed: false,
    requiresPerPlayerState: true,
    hasPairPacks: true,
  },
  da_vinci_code: {
    name: '达芬奇密码',
    minPlayers: 2,
    maxPlayers: 4,
    description: '推理并猜出对手隐藏的数字牌，最后存活的玩家获胜。',
    botsAllowed: true,
    requiresPerPlayerState: true,
  },
  draw_guess: {
    name: '你画我猜',
    minPlayers: 2,
    maxPlayers: 8,
    description: '轮流作画，其他玩家在聊天中猜词，先猜对得分更高。',
    botsAllowed: false,
    requiresPerPlayerState: true,
    hasWordPacks: true,
  },
  act_guess: {
    name: '你比画我猜',
    minPlayers: 2,
    maxPlayers: 12,
    description: '轮流用肢体比划词语，队友在聊天中猜词；可选分队，对方可见词语监督公平。',
    botsAllowed: false,
    requiresPerPlayerState: true,
    hasWordPacks: true,
  },
  german_heart_attack: {
    name: '德国心脏病',
    minPlayers: 2,
    maxPlayers: 6,
    description: '轮流出牌，某种水果合计恰好为 5 时抢先拍铃，先出完手牌者获胜。',
    botsAllowed: true,
    requiresPerPlayerState: true,
  },
  werewolf: {
    name: '狼人杀',
    minPlayers: 6,
    maxPlayers: 12,
    description: '狼人夜间刀人，好人白天放逐，可配置角色板。',
    botsAllowed: true,
    requiresPerPlayerState: true,
  },
  gomoku: {
    name: '五子棋',
    minPlayers: 2,
    maxPlayers: 2,
    description: '黑白轮流落子，先在棋盘上连成五子者获胜。',
    botsAllowed: true,
    requiresPerPlayerState: false,
  },
  go: {
    name: '围棋',
    minPlayers: 2,
    maxPlayers: 2,
    description: '双人对弈，中国规则数子法，支持让子与读秒。',
    botsAllowed: true,
    requiresPerPlayerState: false,
  },
  chess: {
    name: '国际象棋',
    minPlayers: 2,
    maxPlayers: 2,
    description: '标准规则双人对弈，Fischer 计时。',
    botsAllowed: true,
    requiresPerPlayerState: false,
  },
  script_murder: {
    name: '剧本杀',
    minPlayers: 4,
    maxPlayers: 8,
    description: '按剧本扮演角色，搜证讨论并投票指认，房主可主持推进流程。',
    botsAllowed: false,
    requiresPerPlayerState: true,
    hasScripts: true,
  },
  dwarf_mine: {
    name: '矮人矿坑',
    minPlayers: 3,
    maxPlayers: 10,
    description: '隐藏身份阵营，铺设通道寻找金矿；支持基本版与 Saboteur 2 扩展版，3 轮累计金块最多者胜。',
    botsAllowed: false,
    requiresPerPlayerState: true,
  },
  chinese_chess: {
    name: '中国象棋',
    minPlayers: 2,
    maxPlayers: 2,
    description: '标准中国象棋，支持计时、求和、AI 与复盘。',
    botsAllowed: true,
    requiresPerPlayerState: false,
  },
};

export const AI_DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: '简单',
  medium: '普通',
  hard: '困难',
  expert: '专家',
};

export const ALL_GAME_TYPES: GameType[] = [
  'undercover',
  'da_vinci_code',
  'draw_guess',
  'act_guess',
  'german_heart_attack',
  'werewolf',
  'gomoku',
  'go',
  'chess',
  'script_murder',
  'dwarf_mine',
  'chinese_chess',
];

/** Tuple for Zod `z.enum()` — single source with ALL_GAME_TYPES */
export const GAME_TYPE_ZOD_VALUES = ALL_GAME_TYPES as [GameType, ...GameType[]];

export const ALL_AI_DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
