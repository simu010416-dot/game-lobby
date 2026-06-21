import { pickRandom, shuffle } from '@game-lobby/game-core';
import type { GameParticipant } from '@game-lobby/game-core';

export type AvalonRole =
  | 'loyal'
  | 'merlin'
  | 'percival'
  | 'minion'
  | 'assassin'
  | 'morgana'
  | 'mordred'
  | 'oberon';

export type AvalonRoleOrHidden = AvalonRole | 'unknown';

export type AvalonPhase =
  | 'team_propose'
  | 'team_vote'
  | 'mission_play'
  | 'mission_reveal'
  | 'lady_pick'
  | 'assassination'
  | 'ended';

export type AvalonWinner = 'good' | 'evil';

export interface EvilChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  quest: number;
}

export interface QuestResult {
  quest: number;
  success: boolean;
  failCount: number;
  teamIds: string[];
}

export interface LadyRecord {
  holderId: string;
  holderName: string;
  targetId: string;
  targetName: string;
  isEvil: boolean;
  quest: number;
}

export interface AvalonPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  role: AvalonRoleOrHidden;
}

export interface AvalonViewerInfo {
  myRole?: AvalonRole;
  evilTeammates?: { id: string; name: string }[];
  merlinSeesEvil?: { id: string; name: string }[];
  percivalSees?: { id: string; name: string }[];
  ladyResults?: LadyRecord[];
}

export interface AvalonGameState {
  phase: AvalonPhase;
  quest: number;
  leaderIndex: number;
  rejectStreak: number;
  successCount: number;
  failCount: number;
  proposedTeam: string[];
  teamVotes: Record<string, boolean>;
  missionVotes: Record<string, boolean>;
  questHistory: QuestResult[];
  players: AvalonPlayerState[];
  useLadyOfLake: boolean;
  ladyHolderId: string | null;
  ladyUsedOn: string[];
  ladyHistory: LadyRecord[];
  evilChats: EvilChatMessage[];
  lastMissionFailCount: number | null;
  winner: AvalonWinner | null;
  winReason: string | null;
  message: string;
  viewerInfo?: AvalonViewerInfo;
}

export interface AvalonStartOptions {
  useLadyOfLake?: boolean;
}

export const ROLE_LABELS: Record<AvalonRole, string> = {
  loyal: '忠臣',
  merlin: '梅林',
  percival: '派西维尔',
  minion: '爪牙',
  assassin: '刺客',
  morgana: '莫甘娜',
  mordred: '莫德雷德',
  oberon: '奥伯伦',
};

const EVIL_ROLES: AvalonRole[] = ['minion', 'assassin', 'morgana', 'mordred', 'oberon'];

export const QUEST_TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 6, 6],
};

/** Quest numbers (1-based) that require 2 fail cards */
export const TWO_FAIL_QUESTS: Record<number, number[]> = {
  7: [4],
  8: [4],
  9: [4],
  10: [4],
};

export const ROLE_PRESETS: Record<number, AvalonRole[]> = {
  5: ['merlin', 'loyal', 'loyal', 'assassin', 'minion'],
  6: ['merlin', 'loyal', 'loyal', 'assassin', 'minion', 'minion'],
  7: ['merlin', 'loyal', 'loyal', 'assassin', 'minion', 'minion', 'minion'],
  8: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred'],
  9: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred'],
  10: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred', 'oberon'],
};

function playerById(state: AvalonGameState, id: string): AvalonPlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function trueRole(state: AvalonGameState, id: string): AvalonRole | undefined {
  const p = playerById(state, id);
  return p && p.role !== 'unknown' ? p.role : undefined;
}

export function isEvilRole(role: AvalonRole): boolean {
  return EVIL_ROLES.includes(role);
}

export function isGoodRole(role: AvalonRole): boolean {
  return !isEvilRole(role);
}

export function getTeamSize(playerCount: number, quest: number): number {
  const sizes = QUEST_TEAM_SIZES[playerCount];
  if (!sizes) return 0;
  return sizes[quest - 1] ?? 0;
}

export function failsRequired(playerCount: number, quest: number): number {
  const twoFail = TWO_FAIL_QUESTS[playerCount] ?? [];
  return twoFail.includes(quest) ? 2 : 1;
}

export function validatePlayerCount(count: number): { ok: boolean; message?: string } {
  if (count < 5) return { ok: false, message: '阿瓦隆至少需要 5 名玩家' };
  if (count > 10) return { ok: false, message: '阿瓦隆最多 10 名玩家' };
  return { ok: true };
}

function currentLeader(state: AvalonGameState): AvalonPlayerState {
  return state.players[state.leaderIndex]!;
}

function nextLeaderIndex(state: AvalonGameState): number {
  return (state.leaderIndex + 1) % state.players.length;
}

function endGame(state: AvalonGameState, winner: AvalonWinner, reason: string): AvalonGameState {
  return {
    ...state,
    phase: 'ended',
    winner,
    winReason: reason,
    message: winner === 'good' ? '好人阵营获胜！' : '邪恶阵营获胜！',
    proposedTeam: [],
    teamVotes: {},
    missionVotes: {},
  };
}

function resetRoundVotes(state: AvalonGameState): Partial<AvalonGameState> {
  return {
    proposedTeam: [],
    teamVotes: {},
    missionVotes: {},
    lastMissionFailCount: null,
  };
}

export function createAvalonGame(
  participants: GameParticipant[],
  options: AvalonStartOptions = {},
): AvalonGameState {
  const validation = validatePlayerCount(participants.length);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const preset = ROLE_PRESETS[participants.length];
  if (!preset) {
    throw new Error('不支持该人数');
  }

  const shuffledRoles = shuffle([...preset]);
  const shuffledParticipants = shuffle([...participants]);

  const players: AvalonPlayerState[] = shuffledParticipants.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    seatIndex: i,
    role: shuffledRoles[i]!,
  }));

  const leaderIndex = 0;
  const ladyHolderId = players[(leaderIndex + 1) % players.length]!.id;

  return {
    phase: 'team_propose',
    quest: 1,
    leaderIndex,
    rejectStreak: 0,
    successCount: 0,
    failCount: 0,
    proposedTeam: [],
    teamVotes: {},
    missionVotes: {},
    questHistory: [],
    players,
    useLadyOfLake: options.useLadyOfLake ?? true,
    ladyHolderId,
    ladyUsedOn: [],
    ladyHistory: [],
    evilChats: [],
    lastMissionFailCount: null,
    winner: null,
    winReason: null,
    message: `${players[leaderIndex]!.name} 担任队长，请提议第 1 轮任务队伍。`,
  };
}

export function proposeTeam(
  state: AvalonGameState,
  leaderId: string,
  memberIds: string[],
): AvalonGameState {
  if (state.phase !== 'team_propose') return state;
  const leader = currentLeader(state);
  if (leader.id !== leaderId) return state;

  const required = getTeamSize(state.players.length, state.quest);
  if (memberIds.length !== required) return state;

  const validIds = new Set(state.players.map((p) => p.id));
  if (!memberIds.every((id) => validIds.has(id))) return state;
  if (new Set(memberIds).size !== memberIds.length) return state;

  return {
    ...state,
    phase: 'team_vote',
    proposedTeam: memberIds,
    teamVotes: {},
    message: `第 ${state.quest} 轮任务队伍已提出，请投票是否通过。`,
  };
}

function resolveTeamVote(state: AvalonGameState): AvalonGameState {
  const allVoted = state.players.every((p) => state.teamVotes[p.id] !== undefined);
  if (!allVoted) return state;

  const approveCount = Object.values(state.teamVotes).filter(Boolean).length;
  const approved = approveCount > state.players.length / 2;

  if (approved) {
    return {
      ...state,
      phase: 'mission_play',
      rejectStreak: 0,
      missionVotes: {},
      message: `队伍通过（${approveCount} 票赞成），任务成员请出牌。`,
    };
  }

  const newRejectStreak = state.rejectStreak + 1;
  if (newRejectStreak >= 5) {
    return endGame(state, 'evil', '连续 5 次否决队伍，邪恶阵营获胜');
  }

  const nextLeader = nextLeaderIndex(state);
  return {
    ...state,
    phase: 'team_propose',
    leaderIndex: nextLeader,
    rejectStreak: newRejectStreak,
    ...resetRoundVotes(state),
    message: `队伍被否决（${approveCount} 票赞成），${state.players[nextLeader]!.name} 成为新队长。`,
  };
}

export function submitTeamVote(
  state: AvalonGameState,
  playerId: string,
  approve: boolean,
): AvalonGameState {
  if (state.phase !== 'team_vote') return state;
  if (!playerById(state, playerId)) return state;
  if (state.teamVotes[playerId] !== undefined) return state;

  const next = {
    ...state,
    teamVotes: { ...state.teamVotes, [playerId]: approve },
  };
  return resolveTeamVote(next);
}

export function submitMissionCard(
  state: AvalonGameState,
  playerId: string,
  success: boolean,
): AvalonGameState {
  if (state.phase !== 'mission_play') return state;
  if (!state.proposedTeam.includes(playerId)) return state;
  if (state.missionVotes[playerId] !== undefined) return state;

  const role = trueRole(state, playerId);
  if (role && isGoodRole(role) && !success) return state;

  const nextVotes = { ...state.missionVotes, [playerId]: success };
  const allVoted = state.proposedTeam.every((id) => nextVotes[id] !== undefined);
  if (!allVoted) {
    return { ...state, missionVotes: nextVotes };
  }

  const failCount = state.proposedTeam.filter((id) => nextVotes[id] === false).length;
  return {
    ...state,
    phase: 'mission_reveal',
    missionVotes: nextVotes,
    lastMissionFailCount: failCount,
    message: `任务结束，出现 ${failCount} 张失败牌。`,
  };
}

export function advanceFromMissionReveal(state: AvalonGameState): AvalonGameState {
  if (state.phase !== 'mission_reveal') return state;

  const failCount = state.lastMissionFailCount ?? 0;
  const requiredFails = failsRequired(state.players.length, state.quest);
  const missionSuccess = failCount < requiredFails;

  const questResult: QuestResult = {
    quest: state.quest,
    success: missionSuccess,
    failCount,
    teamIds: [...state.proposedTeam],
  };

  const successCount = state.successCount + (missionSuccess ? 1 : 0);
  const failCountTotal = state.failCount + (missionSuccess ? 0 : 1);
  const questHistory = [...state.questHistory, questResult];

  if (successCount >= 3) {
    return {
      ...state,
      successCount,
      failCount: failCountTotal,
      questHistory,
      phase: 'assassination',
      message: '好人完成 3 次任务！刺客请猜测梅林。',
    };
  }

  if (failCountTotal >= 3) {
    return endGame(
      { ...state, successCount, failCount: failCountTotal, questHistory },
      'evil',
      '邪恶阵营破坏 3 次任务',
    );
  }

  const nextQuest = state.quest + 1;
  const nextLeader = nextLeaderIndex(state);

  if (
    state.useLadyOfLake &&
    [2, 3, 4].includes(state.quest) &&
    state.ladyHolderId != null
  ) {
    return {
      ...state,
      successCount,
      failCount: failCountTotal,
      questHistory,
      phase: 'lady_pick',
      quest: nextQuest,
      leaderIndex: nextLeader,
      ...resetRoundVotes(state),
      message: `${playerById(state, state.ladyHolderId)?.name ?? '持有者'} 请使用湖中仙女调查一名玩家。`,
    };
  }

  return {
    ...state,
    successCount,
    failCount: failCountTotal,
    questHistory,
    phase: 'team_propose',
    quest: nextQuest,
    leaderIndex: nextLeader,
    ...resetRoundVotes(state),
    message: `第 ${nextQuest} 轮开始，${state.players[nextLeader]!.name} 担任队长。`,
  };
}

export function submitLadyPick(
  state: AvalonGameState,
  holderId: string,
  targetId: string,
): AvalonGameState {
  if (state.phase !== 'lady_pick') return state;
  if (state.ladyHolderId !== holderId) return state;
  if (holderId === targetId) return state;
  if (state.ladyUsedOn.includes(targetId)) return state;

  const target = playerById(state, targetId);
  const holder = playerById(state, holderId);
  if (!target || !holder) return state;

  const targetRole = target.role as AvalonRole;
  const record: LadyRecord = {
    holderId,
    holderName: holder.name,
    targetId,
    targetName: target.name,
    isEvil: isEvilRole(targetRole),
    quest: state.quest - 1,
  };

  return {
    ...state,
    phase: 'team_propose',
    ladyHolderId: targetId,
    ladyUsedOn: [...state.ladyUsedOn, targetId],
    ladyHistory: [...state.ladyHistory, record],
    message: `第 ${state.quest} 轮开始，${currentLeader(state).name} 担任队长。`,
  };
}

export function submitAssassination(
  state: AvalonGameState,
  assassinId: string,
  targetId: string,
): AvalonGameState {
  if (state.phase !== 'assassination') return state;
  const assassinRole = trueRole(state, assassinId);
  if (assassinRole !== 'assassin') return state;

  const targetRole = trueRole(state, targetId);
  if (targetRole === 'merlin') {
    return endGame(state, 'evil', '刺客成功刺杀梅林');
  }
  return endGame(state, 'good', '刺客未能刺杀梅林');
}

let evilChatCounter = 0;

export function sendEvilChat(
  state: AvalonGameState,
  playerId: string,
  text: string,
): AvalonGameState {
  const role = trueRole(state, playerId);
  if (!role || !isEvilRole(role) || role === 'oberon') return state;
  if (state.phase === 'ended') return state;

  const player = playerById(state, playerId);
  if (!player) return state;

  evilChatCounter += 1;
  const msg: EvilChatMessage = {
    id: `evil-${evilChatCounter}`,
    playerId,
    playerName: player.name,
    text: text.trim().slice(0, 200),
    quest: state.quest,
  };

  return {
    ...state,
    evilChats: [...state.evilChats, msg],
  };
}

function buildViewerInfo(state: AvalonGameState, viewerId: string | null): AvalonViewerInfo | undefined {
  if (!viewerId) return undefined;
  const viewer = playerById(state, viewerId);
  if (!viewer || viewer.role === 'unknown') return undefined;

  const myRole = viewer.role as AvalonRole;
  const info: AvalonViewerInfo = { myRole };

  if (isEvilRole(myRole) && myRole !== 'oberon') {
    info.evilTeammates = state.players
      .filter((p) => p.id !== viewerId && p.role !== 'unknown' && isEvilRole(p.role as AvalonRole) && p.role !== 'oberon')
      .map((p) => ({ id: p.id, name: p.name }));
  }

  if (myRole === 'merlin') {
    info.merlinSeesEvil = state.players
      .filter((p) => {
        if (p.role === 'unknown') return false;
        const r = p.role as AvalonRole;
        return isEvilRole(r) && r !== 'mordred' && r !== 'oberon';
      })
      .map((p) => ({ id: p.id, name: p.name }));
  }

  if (myRole === 'percival') {
    info.percivalSees = state.players
      .filter((p) => p.role === 'merlin' || p.role === 'morgana')
      .map((p) => ({ id: p.id, name: p.name }));
  }

  const myLadyRecords = state.ladyHistory.filter((r) => r.holderId === viewerId);
  if (myLadyRecords.length > 0) {
    info.ladyResults = myLadyRecords;
  }

  return info;
}

export function redactAvalonState(
  state: AvalonGameState,
  viewerId: string | null,
): AvalonGameState {
  const isEnded = state.phase === 'ended';
  const viewer = viewerId ? playerById(state, viewerId) : undefined;

  const players = state.players.map((p) => {
    const isSelf = viewerId != null && p.id === viewerId;
    return {
      ...p,
      role: isSelf || isEnded ? p.role : ('unknown' as AvalonRoleOrHidden),
    };
  });

  let missionVotes: Record<string, boolean> = {};
  if (state.phase === 'mission_reveal' || isEnded) {
    missionVotes = state.missionVotes;
  } else if (viewerId && state.missionVotes[viewerId] !== undefined) {
    missionVotes = { [viewerId]: state.missionVotes[viewerId]! };
  }

  const viewerRole = viewer?.role as AvalonRole | undefined;
  const canSeeEvilChat =
    viewerRole && isEvilRole(viewerRole) && viewerRole !== 'oberon';

  return {
    ...state,
    players,
    missionVotes,
    evilChats: canSeeEvilChat ? state.evilChats : [],
    viewerInfo: buildViewerInfo(state, viewerId),
  };
}

export function advancePhaseOnTimeout(state: AvalonGameState, now: number): AvalonGameState {
  void now;
  return state;
}

export function pickRandomTeam(state: AvalonGameState, leaderId: string): string[] | null {
  if (state.phase !== 'team_propose') return null;
  if (currentLeader(state).id !== leaderId) return null;

  const size = getTeamSize(state.players.length, state.quest);
  const pool = shuffle(state.players.map((p) => p.id));
  return pool.slice(0, size);
}

export function pickTeamVote(state: AvalonGameState, playerId: string): boolean {
  const role = trueRole(state, playerId);
  if (role && isEvilRole(role)) {
    return Math.random() < 0.4;
  }
  return Math.random() < 0.7;
}

export function pickMissionCard(state: AvalonGameState, playerId: string): boolean {
  const role = trueRole(state, playerId);
  if (role && isEvilRole(role)) {
    return Math.random() < 0.35;
  }
  return true;
}

export function pickLadyTarget(state: AvalonGameState, holderId: string): string | null {
  if (state.ladyHolderId !== holderId) return null;
  const candidates = state.players.filter(
    (p) => p.id !== holderId && !state.ladyUsedOn.includes(p.id),
  );
  if (candidates.length === 0) return null;
  return pickRandom(candidates)!.id;
}

export function pickAssassinationTarget(state: AvalonGameState): string | null {
  const merlin = state.players.find((p) => p.role === 'merlin');
  if (merlin && Math.random() < 0.3) return merlin.id;
  const candidates = state.players.filter((p) => p.role !== 'assassin');
  return pickRandom(candidates)?.id ?? null;
}
