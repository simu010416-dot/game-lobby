import { getActiveSocket } from '../../lib/socket';

function emit(event: string, payload?: unknown): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit(event, payload, (res: { ok: boolean; message?: string }) => resolve(res ?? { ok: false }));
  });
}

export function emitPlayPath(
  cardId: string,
  row: number,
  col: number,
  rotation: 0 | 90 | 180 | 270,
) {
  return emit('game:dwarf_mine:play_path', { cardId, row, col, rotation });
}

export function emitPlayAction(
  cardId: string,
  targetPlayerId?: string,
  collapseRow?: number,
  collapseCol?: number,
) {
  return emit('game:dwarf_mine:play_action', { cardId, targetPlayerId, collapseRow, collapseCol });
}

export function emitDiscard(cardId: string) {
  return emit('game:dwarf_mine:discard', { cardId });
}

export function emitDiscardTwo(cardId1: string, cardId2: string, faceUpCardId?: string) {
  return emit('game:dwarf_mine:discard_two', { cardId1, cardId2, faceUpCardId });
}

export function emitPass(cardIds: string[]) {
  return emit('game:dwarf_mine:pass', { cardIds });
}

export function emitMapPeek(goalIndex: number) {
  return emit('game:dwarf_mine:map_peek', { goalIndex });
}

export function emitRolePeekContinue() {
  return emit('game:dwarf_mine:role_peek_continue');
}

export function emitPickGold(goldIndex: number) {
  return emit('game:dwarf_mine:pick_gold', { goldIndex });
}

export function emitStealGold(targetId: string) {
  return emit('game:dwarf_mine:steal_gold', { targetId });
}

export function emitSkipSteal() {
  return emit('game:dwarf_mine:skip_steal');
}

export function emitContinue() {
  return emit('game:dwarf_mine:continue');
}
