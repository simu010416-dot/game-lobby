// @ts-expect-error vendored CommonJS bundle has no typed ESM namespace exports
import * as xiangqiPkg from '../vendor/xiangqi.cjs';
import type { XiangqiInstance } from './xiangqi-engine-types.js';

const { Xiangqi } = xiangqiPkg as {
  Xiangqi: new (fen?: string) => XiangqiInstance;
};

export type {
  XiangqiInstance,
  XiangqiPiece,
  XiangqiPrettyMove,
} from './xiangqi-engine-types.js';

export function createXiangqi(fen?: string): XiangqiInstance {
  return new Xiangqi(fen);
}

export const INITIAL_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1';
