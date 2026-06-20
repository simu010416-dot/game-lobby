export interface XiangqiPiece {
  type: string;
  color: 'r' | 'b';
}

export interface XiangqiPrettyMove {
  color: 'r' | 'b';
  from: string;
  to: string;
  flags: string;
  piece: string;
  captured?: string;
  iccs: string;
}

export interface XiangqiInstance {
  fen(): string;
  turn(): 'r' | 'b';
  move(
    move: string | { from: string; to: string },
    options?: { sloppy?: boolean },
  ): XiangqiPrettyMove | null;
  moves(options?: { square?: string; verbose?: boolean }): (string | XiangqiPrettyMove)[];
  in_check(): boolean;
  in_checkmate(): boolean;
  in_stalemate(): boolean;
  in_draw(): boolean;
  game_over(): boolean;
  board(): (XiangqiPiece | null)[][];
  load(fen: string): boolean;
  undo(): XiangqiPrettyMove | null;
}
