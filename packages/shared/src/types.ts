export type GameType = 'undercover' | 'da_vinci_code';

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

export const GAME_META: Record<
  GameType,
  { name: string; minPlayers: number; maxPlayers: number; description: string }
> = {
  undercover: {
    name: '谁是卧底',
    minPlayers: 4,
    maxPlayers: 12,
    description: '平民与卧底轮流描述词语，投票找出卧底。',
  },
  da_vinci_code: {
    name: '达芬奇密码',
    minPlayers: 2,
    maxPlayers: 4,
    description: '推理并猜出对手隐藏的数字牌，最后存活的玩家获胜。',
  },
};

export const AI_DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: '简单',
  medium: '普通',
  hard: '困难',
  expert: '专家',
};

export const ALL_GAME_TYPES: GameType[] = ['undercover', 'da_vinci_code'];

export const ALL_AI_DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
