export {
  createChineseChessGame,
  applyChineseChessMove,
  resignChineseChessGame,
  offerChineseChessDraw,
  respondChineseChessDraw,
  getCurrentPlayerId,
  getLegalMoves,
  replayChineseChessToIndex,
  deductElapsedTime,
  tickChineseChessGame,
  type ChineseChessGameState,
  type ChineseChessPlayerState,
  type ChineseChessColor,
  type ChineseChessPhase,
  type ChineseChessEndReason,
  type ChineseChessLastMove,
  type ChineseChessMoveOption,
  type ChineseChessMoveRecord,
  type ChineseChessTimeSettings,
  type ChineseChessStartOptions,
} from './logic.js';
export { generateBotChineseChessMove, applyBotChineseChessMove } from './bot.js';
export { chineseChessModule } from './module.js';
export { INITIAL_FEN } from './xiangqi-engine.js';
