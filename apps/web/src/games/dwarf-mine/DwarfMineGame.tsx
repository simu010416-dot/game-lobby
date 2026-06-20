import { useEffect, useMemo, useState } from 'react';
import {
  DWARF_MINE_BOARD_ROWS as BOARD_ROWS,
  DWARF_MINE_BOARD_COLS as BOARD_COLS,
  GOAL_ROWS,
  GOAL_COL,
  findValidDwarfMinePathPlacements,
  dwarfMineRoleLabel,
  type DwarfMineGameState,
} from '@game-lobby/game-engine';
import {
  emitContinue,
  emitDiscard,
  emitMapPeek,
  emitPass,
  emitPickGold,
  emitPlayAction,
  emitPlayPath,
  emitRolePeekContinue,
  emitSkipSteal,
  emitStealGold,
} from './socket';
import { DwarfMineCard, DwarfMineGoalTile, DwarfMineStartTile, dwarfMineCardTitle } from './DwarfMineCard';

interface Props {
  state: DwarfMineGameState;
  myMemberId: string | null;
  isSpectator: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  broken_lamp: '坏灯',
  broken_pickaxe: '坏镐',
  broken_cart: '坏矿车',
  repair_lamp: '修灯',
  repair_pickaxe: '修镐',
  repair_cart: '修矿车',
  map: '地图',
  collapse: '崩塌',
  theft: '偷窃',
  hands_off: 'Hands Off',
  swap_hand: '换手',
  inspection: '查验',
  swap_hat: '换帽',
  trapped: '囚禁',
  free: '释放',
};

export function DwarfMineGame({ state, myMemberId, isSpectator }: Props) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState('');

  const me = state.players.find((p) => p.id === myMemberId);
  const current = state.players[state.currentPlayerIndex];
  const isMyTurn = !isSpectator && current?.id === myMemberId && state.phase === 'playing';
  const selectedHandCard = me?.hand.find((c) => c.id === selectedCard) ?? null;
  const selectedPathCard =
    selectedHandCard?.def.kind === 'path' ? selectedHandCard : null;
  const canPlayPathCard =
    Boolean(me) &&
    !me!.isTrapped &&
    !me!.tools.lamp &&
    !me!.tools.pickaxe &&
    !me!.tools.cart;

  const validPlacements = useMemo(() => {
    const map = new Map<string, 0 | 90 | 180 | 270>();
    if (!selectedPathCard || !canPlayPathCard) return map;
    for (const { row, col, rotation: rot } of findValidDwarfMinePathPlacements(
      state.board,
      selectedPathCard.def,
    )) {
      map.set(`${row},${col}`, rot);
    }
    return map;
  }, [selectedPathCard, state.board, canPlayPathCard]);

  useEffect(() => {
    if (!selectedPathCard || validPlacements.size === 0) return;
    const first = validPlacements.values().next().value;
    if (first != null) setRotation(first);
  }, [selectedPathCard, validPlacements]);

  function selectCard(cardId: string) {
    setSelectedCard((prev) => (prev === cardId ? null : cardId));
    setRotation(0);
    setPlacementError('');
  }

  async function handleCellClick(row: number, col: number) {
    if (!selectedPathCard || !isMyTurn || !canPlayPathCard) return;
    const key = `${row},${col}`;
    const rot = validPlacements.get(key);
    if (rot == null) {
      setPlacementError('此处不能放置该通道卡。');
      return;
    }
    setRotation(rot);
    const res = await emitPlayPath(selectedPathCard.id, row, col, rot);
    if (res.ok) {
      setSelectedCard(null);
      setRotation(0);
      setPlacementError('');
    } else {
      setPlacementError(res.message ?? '放置失败');
    }
  }

  async function handlePlayAction() {
    if (!selectedCard || !isMyTurn) return;
    await emitPlayAction(selectedCard, targetPlayer ?? undefined);
    setSelectedCard(null);
    setTargetPlayer(null);
  }

  async function handleDiscard() {
    if (!selectedCard || !isMyTurn) return;
    if (state.mode === 'base') {
      await emitDiscard(selectedCard);
    }
    setSelectedCard(null);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong>
            第 {state.round}/{state.maxRounds} 轮
          </strong>
          <span style={{ marginLeft: '0.75rem', color: 'var(--text-muted)' }}>
            {state.mode === 'expansion' ? '扩展版' : '基本版'}
          </span>
        </div>
        <div style={{ fontSize: '0.9rem' }}>{state.message}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(44px, 1fr))`,
          gap: 4,
          maxWidth: '100%',
          overflow: 'auto',
          background: 'linear-gradient(180deg, #1c1917 0%, #292524 100%)',
          padding: '0.75rem',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}
      >
        {Array.from({ length: BOARD_ROWS }, (_, row) =>
          Array.from({ length: BOARD_COLS }, (_, col) => {
            const cell = state.board[row]?.[col];
            const isGoal = GOAL_ROWS.includes(row as (typeof GOAL_ROWS)[number]) && col === GOAL_COL;
            const isStart = cell?.cellType === 'start';
            const hasCard = Boolean(cell?.card);
            const key = `${row},${col}`;
            const canPlaceHere = validPlacements.has(key);
            const isEmpty = cell?.cellType === 'empty';
            const cellClickable = isMyTurn && Boolean(selectedPathCard) && canPlayPathCard && canPlaceHere;
            const previewRotation = canPlaceHere ? validPlacements.get(key) : undefined;

            return (
              <div
                key={key}
                role={cellClickable ? 'button' : undefined}
                tabIndex={cellClickable ? 0 : undefined}
                onClick={() => cellClickable && handleCellClick(row, col)}
                onKeyDown={(e) => {
                  if (cellClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleCellClick(row, col);
                  }
                }}
                style={{
                  minHeight: 56,
                  minWidth: 44,
                  padding: 2,
                  borderRadius: 6,
                  border: canPlaceHere
                    ? '2px solid #4ade80'
                    : isStart
                      ? '2px solid #fde68a'
                      : '1px solid rgba(255,255,255,0.08)',
                  background: canPlaceHere
                    ? 'rgba(74, 222, 128, 0.18)'
                    : isEmpty
                      ? 'rgba(0,0,0,0.25)'
                      : 'rgba(255,255,255,0.04)',
                  cursor: cellClickable ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: canPlaceHere ? 'inset 0 0 12px rgba(74,222,128,0.25)' : undefined,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                title={
                  canPlaceHere
                    ? '点击放置通道卡'
                    : isStart
                      ? '起点：通道向东延伸'
                      : `${row},${col}`
                }
              >
                {isStart ? (
                  <DwarfMineStartTile size="xs" />
                ) : isGoal ? (
                  <DwarfMineGoalTile
                    size="xs"
                    revealed={Boolean(cell?.goalRevealed)}
                    hasGold={cell?.goalHasGold}
                  />
                ) : cell?.card ? (
                  <DwarfMineCard
                    card={cell.card}
                    rotation={cell.rotation}
                    size="xs"
                    passive
                    title={dwarfMineCardTitle(cell.card)}
                  />
                ) : canPlaceHere && selectedPathCard ? (
                  <DwarfMineCard
                    card={selectedPathCard}
                    rotation={previewRotation ?? 0}
                    size="xs"
                    passive
                    title={dwarfMineCardTitle(selectedPathCard)}
                  />
                ) : null}
              </div>
            );
          }),
        )}
      </div>

      {placementError && (
        <p style={{ margin: 0, color: 'var(--danger)', fontSize: '0.9rem' }}>{placementError}</p>
      )}

      {isMyTurn && selectedPathCard && !canPlayPathCard && (
        <p style={{ margin: 0, color: 'var(--danger)', fontSize: '0.9rem' }}>
          工具损坏或被囚禁，不能出通道卡。
        </p>
      )}

      {isMyTurn && selectedPathCard && canPlayPathCard && validPlacements.size === 0 && (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          当前手牌没有可放置的通道位置，请出行动卡或弃牌。
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {state.players.map((p) => (
          <div
            key={p.id}
            className="card"
            style={{
              padding: '0.5rem 0.75rem',
              minWidth: 120,
              border:
                current?.id === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
            }}
          >
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              金块: {state.totalGold[p.id] ?? 0}
              {p.role !== ('hidden' as typeof p.role) && state.rolesRevealed && ` · ${dwarfMineRoleLabel(p.role)}`}
            </div>
            {(p.tools.lamp || p.tools.pickaxe || p.tools.cart) && (
              <div style={{ fontSize: '0.7rem', color: '#f87171' }}>
                {p.tools.lamp && '灯 '}
                {p.tools.pickaxe && '镐 '}
                {p.tools.cart && '车 '}
              </div>
            )}
            {p.isTrapped && <div style={{ fontSize: '0.7rem', color: '#f87171' }}>囚禁</div>}
            {p.faceUpCards.length > 0 && (
              <div style={{ fontSize: '0.65rem' }}>
                {p.faceUpCards.map((f) => ACTION_LABELS[f.actionKind] ?? f.actionKind).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isSpectator && me && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            我的手牌 ({me.hand.length})
            {isMyTurn && ' — 你的回合'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {me.hand.map((card) => (
              <DwarfMineCard
                key={card.id}
                card={card}
                rotation={selectedCard === card.id && card.def.kind === 'path' ? rotation : 0}
                size="md"
                selected={selectedCard === card.id}
                title={dwarfMineCardTitle(card)}
                onClick={() => selectCard(card.id)}
              />
            ))}
          </div>

          {isMyTurn && selectedPathCard && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                background: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>点击绿色格子放置（自动选择合法旋转）</span>
              <button type="button" className="btn btn-ghost" onClick={() => setRotation((r) => ((r + 270) % 360) as 0 | 90 | 180 | 270)}>
                ↺ 预览左转
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}>
                ↻ 预览右转
              </button>
              {state.mode === 'base' && (
                <button type="button" className="btn" onClick={handleDiscard}>
                  弃牌
                </button>
              )}
            </div>
          )}

          {isMyTurn && selectedCard && selectedHandCard?.def.kind === 'action' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <select
                className="input"
                value={targetPlayer ?? ''}
                onChange={(e) => setTargetPlayer(e.target.value || null)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">选择目标玩家</option>
                {state.players
                  .filter((p) => p.id !== myMemberId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn primary" onClick={handlePlayAction}>
                出行动卡
              </button>
              {state.mode === 'base' && (
                <button type="button" className="btn" onClick={handleDiscard}>
                  弃牌
                </button>
              )}
              {state.mode === 'expansion' && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      if (!selectedCard || !me.hand[1]) return;
                      const other = me.hand.find((c) => c.id !== selectedCard);
                      if (!other) return;
                      await emitPass([selectedCard]);
                    }}
                  >
                    Pass 弃牌
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {state.phase === 'map_peek' && me && state.pendingAction?.type === 'map_peek' && state.pendingAction.playerId === myMemberId && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <p>选择要查看的终点：</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[0, 1, 2].map((i) => (
              <button key={i} type="button" className="btn" onClick={() => emitMapPeek(i)}>
                终点 {i + 1}
              </button>
            ))}
          </div>
          {state.privatePeek && (
            <p style={{ marginTop: '0.5rem' }}>
              结果：{state.privatePeek.hasGold ? '含金矿' : '石块'}（仅你可见）
            </p>
          )}
        </div>
      )}

      {state.phase === 'role_peek' && me && state.pendingAction?.type === 'role_peek' && state.pendingAction.playerId === myMemberId && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <p>
            查验结果：{dwarfMineRoleLabel(state.pendingAction.revealedRole)}
          </p>
          <button type="button" className="btn primary" onClick={() => emitRolePeekContinue()}>
            继续
          </button>
        </div>
      )}

      {state.phase === 'gold_distribution' && isMyTurn && me && state.goldDistributionQueue[state.goldDistributionIndex] === myMemberId && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <p>选取一张金块：</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {state.goldPool.map((g, i) => (
              <button key={i} type="button" className="btn primary" onClick={() => emitPickGold(i)}>
                {g} 金
              </button>
            ))}
          </div>
        </div>
      )}

      {state.phase === 'theft_resolution' && isMyTurn && me && state.theftQueue[state.theftIndex] === myMemberId && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <p>偷窃阶段：选择要偷取的玩家</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {state.players
              .filter((p) => p.id !== myMemberId && (state.totalGold[p.id] ?? 0) > 0)
              .map((p) => (
                <button key={p.id} type="button" className="btn" onClick={() => emitStealGold(p.id)}>
                  偷 {p.name}
                </button>
              ))}
            <button type="button" className="btn" onClick={() => emitSkipSteal()}>
              跳过
            </button>
          </div>
        </div>
      )}

      {state.phase === 'round_end' && !isSpectator && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <p>本轮结束。累计金块：</p>
          <ul style={{ margin: '0.5rem 0' }}>
            {state.players.map((p) => (
              <li key={p.id}>
                {p.name}: {state.totalGold[p.id] ?? 0}（本轮 +{p.roundGold}）
                {p.role !== ('hidden' as typeof p.role) && ` · ${dwarfMineRoleLabel(p.role)}`}
              </li>
            ))}
          </ul>
          {state.round < state.maxRounds && (
            <button type="button" className="btn primary" onClick={() => emitContinue()}>
              开始下一轮
            </button>
          )}
        </div>
      )}

      {state.phase === 'ended' && (
        <div className="card" style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.1)' }}>
          <h3 style={{ margin: '0 0 0.5rem' }}>游戏结束</h3>
          <ul>
            {(state.winnerIds ?? []).map((id) => {
              const p = state.players.find((x) => x.id === id);
              return (
                <li key={id}>
                  胜者 {p?.name} — {state.totalGold[id] ?? 0} 金块
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
        牌库 {state.deckCount} · 弃牌 {state.discardCount}
        {state.mode === 'expansion' && ` · 移除 ${state.removedDeckCount}`}
      </p>
    </div>
  );
}
