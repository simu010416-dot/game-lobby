export {
  createUndercoverGame,
  submitUndercoverDescription,
  submitUndercoverVote,
  generateBotDescription,
  generateBotVote,
  type UndercoverGameState,
  type UndercoverPlayerState,
  type UndercoverPhase,
} from './logic.js';
export { UNDERCOVER_WORD_PAIRS, UNDERCOVER_HINTS } from './words.js';
export { undercoverModule, type UndercoverStartOptions } from './module.js';
