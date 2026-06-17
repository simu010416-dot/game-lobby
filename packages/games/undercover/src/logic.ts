import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake } from '@game-lobby/game-core';
import { UNDERCOVER_HINTS } from './words.js';

export type UndercoverPhase = 'describe' | 'vote' | 'reveal' | 'ended';

export interface UndercoverPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  isAlive: boolean;
  word: string | null;
  isUndercover: boolean;
  isWhiteBoard: boolean;
  description: string | null;
  votedFor: string | null;
}

export interface UndercoverGameState {
  phase: UndercoverPhase;
  round: number;
  civilianWord: string;
  undercoverWord: string;
  players: UndercoverPlayerState[];
  currentSpeakerIndex: number;
  votes: Record<string, string>;
  winner: 'civilian' | 'undercover' | 'whiteboard' | null;
  message: string;
}

export function createUndercoverGame(
  playerIds: { id: string; name: string; isBot: boolean }[],
  pair: [string, string],
): UndercoverGameState {
  const [civilianWord, undercoverWord] = pair;
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const undercoverIndex = Math.floor(Math.random() * shuffled.length);
  const whiteBoardIndex =
    shuffled.length >= 6
      ? (undercoverIndex + 1 + Math.floor(Math.random() * (shuffled.length - 1))) % shuffled.length
      : -1;

  const players: UndercoverPlayerState[] = shuffled.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    isAlive: true,
    word:
      i === undercoverIndex
        ? undercoverWord
        : i === whiteBoardIndex
          ? null
          : civilianWord,
    isUndercover: i === undercoverIndex,
    isWhiteBoard: i === whiteBoardIndex,
    description: null,
    votedFor: null,
  }));

  return {
    phase: 'describe',
    round: 1,
    civilianWord,
    undercoverWord,
    players,
    currentSpeakerIndex: 0,
    votes: {},
    winner: null,
    message: '请按顺序描述你的词语，不要直接说出词语本身。',
  };
}

export function submitUndercoverDescription(
  state: UndercoverGameState,
  playerId: string,
  description: string,
): UndercoverGameState {
  const alive = state.players.filter((p) => p.isAlive);
  const speaker = alive[state.currentSpeakerIndex];
  if (!speaker || speaker.id !== playerId || state.phase !== 'describe') {
    return state;
  }

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, description } : p,
  );
  const nextIndex = state.currentSpeakerIndex + 1;

  if (nextIndex >= alive.length) {
    return {
      ...state,
      players: updatedPlayers,
      phase: 'vote',
      currentSpeakerIndex: 0,
      message: '描述结束，请投票选出你认为的卧底。',
    };
  }

  return {
    ...state,
    players: updatedPlayers,
    currentSpeakerIndex: nextIndex,
    message: `轮到 ${alive[nextIndex]!.name} 描述。`,
  };
}

export function submitUndercoverVote(
  state: UndercoverGameState,
  voterId: string,
  targetId: string,
): UndercoverGameState {
  if (state.phase !== 'vote') return state;
  const voter = state.players.find((p) => p.id === voterId && p.isAlive);
  if (!voter) return state;

  const votes = { ...state.votes, [voterId]: targetId };
  const alive = state.players.filter((p) => p.isAlive);
  if (Object.keys(votes).length < alive.length) {
    return { ...state, votes, message: '等待其他玩家投票…' };
  }

  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(tally));
  const eliminatedId = Object.entries(tally).find(([, c]) => c === maxVotes)?.[0];
  if (!eliminatedId) return state;

  const eliminated = state.players.find((p) => p.id === eliminatedId)!;
  const updatedPlayers = state.players.map((p) =>
    p.id === eliminatedId ? { ...p, isAlive: false } : p,
  );

  const aliveAfter = updatedPlayers.filter((p) => p.isAlive);
  const undercoverAlive = aliveAfter.some((p) => p.isUndercover);
  const civilianAlive = aliveAfter.filter((p) => !p.isUndercover && !p.isWhiteBoard).length;
  const undercoverCount = aliveAfter.filter((p) => p.isUndercover).length;

  if (!undercoverAlive) {
    return {
      ...state,
      players: updatedPlayers,
      phase: 'ended',
      votes: {},
      winner: 'civilian',
      message: `卧底 ${eliminated.name} 被投出，平民胜利！`,
    };
  }

  if (undercoverCount >= civilianAlive) {
    return {
      ...state,
      players: updatedPlayers,
      phase: 'ended',
      votes: {},
      winner: 'undercover',
      message: `卧底人数占优，卧底胜利！`,
    };
  }

  if (eliminated.isWhiteBoard) {
    return {
      ...state,
      players: updatedPlayers,
      phase: 'ended',
      votes: {},
      winner: 'whiteboard',
      message: `白板 ${eliminated.name} 被误投，白板单独胜利！`,
    };
  }

  return {
    ...state,
    players: updatedPlayers.map((p) => ({ ...p, description: null, votedFor: null })),
    phase: 'describe',
    round: state.round + 1,
    currentSpeakerIndex: 0,
    votes: {},
    message: `${eliminated.name} 被淘汰，进入第 ${state.round + 1} 轮描述。`,
  };
}

export function generateBotDescription(
  player: UndercoverPlayerState,
  difficulty: AiDifficulty,
): string {
  if (player.isWhiteBoard || !player.word) {
    const generic = ['一种常见的东西', '生活中经常见到', '大家都熟悉', '挺普遍的'];
    return pickRandom(generic);
  }

  const hints = UNDERCOVER_HINTS[player.word] ?? ['有趣', '常见', '熟悉'];
  if (shouldBotMakeMistake(difficulty)) {
    const wrongHints = Object.values(UNDERCOVER_HINTS).flat();
    return pickRandom(wrongHints);
  }

  const count = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  return hints.slice(0, count).join('，');
}

export function generateBotVote(
  state: UndercoverGameState,
  botId: string,
  difficulty: AiDifficulty,
): string {
  const alive = state.players.filter((p) => p.isAlive && p.id !== botId);
  const bot = state.players.find((p) => p.id === botId)!;

  if (shouldBotMakeMistake(difficulty) || bot.isUndercover) {
    const nonSelf = alive.filter((p) => !p.isUndercover || bot.isUndercover);
    return pickRandom(nonSelf).id;
  }

  const suspicious = alive.filter((p) => {
    const desc = p.description ?? '';
    return desc.length < 4 || desc.includes('常见') || desc.includes('普遍');
  });
  return (suspicious[0] ?? pickRandom(alive)).id;
}
