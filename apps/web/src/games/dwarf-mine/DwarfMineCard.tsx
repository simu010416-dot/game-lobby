import type { ReactNode } from 'react';
import type { DwarfMineGameCard as GameCard } from '@game-lobby/game-engine';

const DIR_N = 1;
const DIR_E = 2;
const DIR_S = 4;
const DIR_W = 8;

const ACTION_META: Record<
  string,
  { label: string; icon: string; gradFrom: string; gradTo: string; fg: string }
> = {
  broken_lamp: { label: '坏灯', icon: '💡', gradFrom: '#7c2d12', gradTo: '#431407', fg: '#fecaca' },
  broken_pickaxe: { label: '坏镐', icon: '⛏️', gradFrom: '#7c2d12', gradTo: '#431407', fg: '#fecaca' },
  broken_cart: { label: '坏矿车', icon: '🛒', gradFrom: '#7c2d12', gradTo: '#431407', fg: '#fecaca' },
  repair_lamp: { label: '修灯', icon: '🔦', gradFrom: '#166534', gradTo: '#052e16', fg: '#bbf7d0' },
  repair_pickaxe: { label: '修镐', icon: '⚒️', gradFrom: '#166534', gradTo: '#052e16', fg: '#bbf7d0' },
  repair_cart: { label: '修矿车', icon: '🚃', gradFrom: '#166534', gradTo: '#052e16', fg: '#bbf7d0' },
  map: { label: '地图', icon: '🗺️', gradFrom: '#1e40af', gradTo: '#172554', fg: '#bfdbfe' },
  collapse: { label: '崩塌', icon: '🪨', gradFrom: '#44403c', gradTo: '#1c1917', fg: '#e7e5e4' },
  theft: { label: '偷窃', icon: '💰', gradFrom: '#92400e', gradTo: '#451a03', fg: '#fde68a' },
  hands_off: { label: 'Hands Off', icon: '✋', gradFrom: '#6b21a8', gradTo: '#3b0764', fg: '#e9d5ff' },
  swap_hand: { label: '换手', icon: '🔄', gradFrom: '#6b21a8', gradTo: '#3b0764', fg: '#e9d5ff' },
  inspection: { label: '查验', icon: '🔍', gradFrom: '#6b21a8', gradTo: '#3b0764', fg: '#e9d5ff' },
  swap_hat: { label: '换帽', icon: '🎩', gradFrom: '#6b21a8', gradTo: '#3b0764', fg: '#e9d5ff' },
  trapped: { label: '囚禁', icon: '⛓️', gradFrom: '#991b1b', gradTo: '#450a0a', fg: '#fecaca' },
  free: { label: '释放', icon: '🔓', gradFrom: '#166534', gradTo: '#052e16', fg: '#bbf7d0' },
};

const SIZE_MAP = {
  xs: { w: 40, h: 56, font: 6, icon: 14, tunnel: 9 },
  sm: { w: 48, h: 68, font: 7, icon: 16, tunnel: 10 },
  md: { w: 76, h: 108, font: 9, icon: 24, tunnel: 13 },
  lg: { w: 100, h: 140, font: 11, icon: 30, tunnel: 15 },
} as const;

function rotateConnections(conns: number, rotation: 0 | 90 | 180 | 270): number {
  let result = 0;
  const dirs = [DIR_N, DIR_E, DIR_S, DIR_W];
  for (let i = 0; i < 4; i++) {
    if (conns & dirs[i]!) {
      const newIdx = (i + rotation / 90) % 4;
      result |= dirs[newIdx]!;
    }
  }
  return result;
}

function edgePoint(dir: number, cx: number, cy: number, r: number): [number, number] {
  if (dir === DIR_N) return [cx, cy - r];
  if (dir === DIR_E) return [cx + r, cy];
  if (dir === DIR_S) return [cx, cy + r];
  return [cx - r, cy];
}

function CardDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e8c98a" />
        <stop offset="45%" stopColor="#c9a45c" />
        <stop offset="100%" stopColor="#8b6914" />
      </linearGradient>
      <linearGradient id={`${id}-tunnel`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#57534e" />
        <stop offset="50%" stopColor="#292524" />
        <stop offset="100%" stopColor="#1c1917" />
      </linearGradient>
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

function CardFrame({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
      <CardDefs id={id} />
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="9"
        fill={`url(#${id}-bg)`}
        stroke="#78350f"
        strokeWidth="2.5"
        filter={`url(#${id}-shadow)`}
      />
      <rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke="#fde68a" strokeWidth="1" opacity="0.45" />
      {children}
    </svg>
  );
}

function TunnelSegment({
  dir,
  cx,
  cy,
  r,
  width,
  gradientId,
  deadEnd,
}: {
  dir: number;
  cx: number;
  cy: number;
  r: number;
  width: number;
  gradientId: string;
  deadEnd?: boolean;
}) {
  const [ex, ey] = edgePoint(dir, cx, cy, r);
  return (
    <g>
      <line
        x1={cx}
        y1={cy}
        x2={ex}
        y2={ey}
        stroke={`url(#${gradientId})`}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={ex}
        y2={ey}
        stroke="#78716c"
        strokeWidth={width * 0.35}
        strokeLinecap="round"
        opacity="0.55"
      />
      {deadEnd && (
        <>
          <circle cx={ex} cy={ey} r={width * 0.75} fill="#44403c" stroke="#a8a29e" strokeWidth="1.5" />
          <line
            x1={ex - width * 0.4}
            y1={ey - width * 0.4}
            x2={ex + width * 0.4}
            y2={ey + width * 0.4}
            stroke="#78716c"
            strokeWidth="1.5"
          />
          <line
            x1={ex + width * 0.4}
            y1={ey - width * 0.4}
            x2={ex - width * 0.4}
            y2={ey + width * 0.4}
            stroke="#78716c"
            strokeWidth="1.5"
          />
        </>
      )}
    </g>
  );
}

function PathArt({
  connections,
  secondaryConnections,
  doorColor,
  crystals,
  hasLadder,
  size,
  uid,
}: {
  connections: number;
  secondaryConnections?: number;
  doorColor?: 'green' | 'blue';
  crystals?: number;
  hasLadder?: boolean;
  size: keyof typeof SIZE_MAP;
  uid: string;
}) {
  const cx = 50;
  const cy = 50;
  const r = 36;
  const width = SIZE_MAP[size].tunnel;

  function renderTunnel(conns: number, opacity = 1) {
    const dirs = [DIR_N, DIR_E, DIR_S, DIR_W].filter((d) => conns & d);
    const dead = dirs.length === 1;
    return (
      <g opacity={opacity}>
        {dirs.map((dir) => (
          <TunnelSegment
            key={dir}
            dir={dir}
            cx={cx}
            cy={cy}
            r={r}
            width={width}
            gradientId={`${uid}-tunnel`}
            deadEnd={dead}
          />
        ))}
        <circle cx={cx} cy={cy} r={width * 0.45} fill="#292524" stroke="#78716c" strokeWidth="1" />
      </g>
    );
  }

  return (
    <CardFrame id={uid}>
      {renderTunnel(connections)}
      {secondaryConnections != null && renderTunnel(secondaryConnections, 0.82)}
      {doorColor && (
        <g>
          <rect
            x="34"
            y="34"
            width="32"
            height="32"
            rx="5"
            fill={doorColor === 'green' ? '#16a34a' : '#2563eb'}
            stroke="#fef9c3"
            strokeWidth="2"
          />
          <circle cx="50" cy="50" r="4" fill="#fde68a" />
        </g>
      )}
      {hasLadder && (
        <g stroke="#fef3c7" strokeWidth="2.5" strokeLinecap="round">
          <line x1="43" y1="28" x2="43" y2="72" />
          <line x1="57" y1="28" x2="57" y2="72" />
          {[36, 44, 52, 60, 68].map((y) => (
            <line key={y} x1="43" y1={y} x2="57" y2={y} />
          ))}
        </g>
      )}
      {crystals != null &&
        crystals > 0 &&
        Array.from({ length: crystals }).map((_, i) => (
          <g key={i} transform={`translate(${68 - i * 12}, 14)`}>
            <polygon points="0,0 6,10 -6,10" fill="#67e8f9" stroke="#0891b2" strokeWidth="1" />
            <polygon points="0,2 4,9 -4,9" fill="#a5f3fc" opacity="0.8" />
          </g>
        ))}
    </CardFrame>
  );
}

function ActionArt({ actionKind, size, uid }: { actionKind: string; size: keyof typeof SIZE_MAP; uid: string }) {
  const meta = ACTION_META[actionKind] ?? {
    label: actionKind,
    icon: '❓',
    gradFrom: '#374151',
    gradTo: '#111827',
    fg: '#f3f4f6',
  };
  const dims = SIZE_MAP[size];

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-act`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={meta.gradFrom} />
          <stop offset="100%" stopColor={meta.gradTo} />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="9"
        fill={`url(#${uid}-act)`}
        stroke="#1c1917"
        strokeWidth="2"
        filter={`url(#${uid}-shadow)`}
      />
      <rect x="8" y="8" width="84" height="84" rx="6" fill="none" stroke={meta.fg} strokeWidth="1" opacity="0.25" />
      <text x="50" y="44" textAnchor="middle" fontSize={dims.icon + 10}>
        {meta.icon}
      </text>
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill={meta.fg}
        fontSize={dims.font + 2}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {meta.label}
      </text>
    </svg>
  );
}

/** 起点：矿洞入口，通道向北、东、南延伸 */
export function DwarfMineStartTile({ size = 'xs' }: { size?: keyof typeof SIZE_MAP }) {
  const uid = `start-${size}`;
  const width = SIZE_MAP[size].tunnel;
  return (
    <CardFrame id={uid}>
      <rect x="8" y="22" width="24" height="56" rx="6" fill="#44403c" stroke="#78716c" strokeWidth="1.5" />
      <path d="M 32 50 Q 24 50 24 38 L 24 62 Q 24 50 32 50" fill="#1c1917" />
      <TunnelSegment dir={DIR_N} cx={50} cy={50} r={36} width={width} gradientId={`${uid}-tunnel`} />
      <TunnelSegment dir={DIR_E} cx={50} cy={50} r={36} width={width} gradientId={`${uid}-tunnel`} />
      <TunnelSegment dir={DIR_S} cx={50} cy={50} r={36} width={width} gradientId={`${uid}-tunnel`} />
      <circle cx="20" cy="38" r="3" fill="#fde68a" opacity="0.9" />
      <text x="20" y="72" textAnchor="middle" fill="#fde68a" fontSize="8" fontWeight="700">
        入口
      </text>
    </CardFrame>
  );
}

/** 终点格：未揭示 / 金矿 / 石块 */
export function DwarfMineGoalTile({
  revealed,
  hasGold,
  size = 'xs',
}: {
  revealed: boolean;
  hasGold?: boolean;
  size?: keyof typeof SIZE_MAP;
}) {
  const uid = `goal-${size}-${revealed ? (hasGold ? 'gold' : 'rock') : 'hidden'}`;
  const width = SIZE_MAP[size].tunnel;

  return (
    <CardFrame id={uid}>
      {!revealed ? (
        <>
          <TunnelSegment dir={DIR_W} cx={50} cy={50} r={36} width={width} gradientId={`${uid}-tunnel`} />
          <circle cx="50" cy="42" r="14" fill="#57534e" stroke="#78716c" strokeWidth="2" />
          <text x="50" y="47" textAnchor="middle" fill="#fde68a" fontSize="16" fontWeight="800">
            ?
          </text>
        </>
      ) : hasGold ? (
        <>
          <TunnelSegment dir={DIR_W} cx={50} cy={50} r={36} width={width} gradientId={`${uid}-tunnel`} />
          <circle cx="50" cy="50" r="16" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
          <text x="50" y="55" textAnchor="middle" fontSize="14">
            🥇
          </text>
        </>
      ) : (
        <>
          <TunnelSegment dir={DIR_W} cx={50} cy={50} r={36} width={width} gradientId={`${uid}-tunnel`} />
          <rect x="34" y="34" width="32" height="32" rx="4" fill="#78716c" stroke="#57534e" strokeWidth="2" />
        </>
      )}
    </CardFrame>
  );
}

export interface DwarfMineCardProps {
  card: GameCard;
  rotation?: 0 | 90 | 180 | 270;
  size?: keyof typeof SIZE_MAP;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  /** 嵌入棋盘时禁用指针事件，避免阻挡落子点击 */
  passive?: boolean;
}

export function DwarfMineCard({
  card,
  rotation = 0,
  size = 'md',
  selected = false,
  onClick,
  title,
  passive = false,
}: DwarfMineCardProps) {
  const dims = SIZE_MAP[size];
  const def = card.def;
  const uid = `${card.id}-${size}-${rotation}`;

  const content =
    def.kind === 'path' ? (
      <PathArt
        connections={rotateConnections(def.connections, rotation)}
        secondaryConnections={
          def.secondaryConnections != null
            ? rotateConnections(def.secondaryConnections, rotation)
            : undefined
        }
        doorColor={def.doorColor}
        crystals={def.crystals}
        hasLadder={def.hasLadder}
        size={size}
        uid={uid}
      />
    ) : (
      <ActionArt actionKind={def.actionKind} size={size} uid={uid} />
    );

  const style: React.CSSProperties = {
    width: dims.w,
    height: dims.h,
    padding: 0,
    border: selected ? '2px solid var(--accent)' : '1px solid rgba(120, 53, 15, 0.45)',
    borderRadius: 8,
    background: 'transparent',
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: selected
      ? '0 0 0 2px rgba(99, 102, 241, 0.45), 0 8px 16px rgba(0,0,0,0.35)'
      : '0 4px 10px rgba(0,0,0,0.28)',
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    transform: selected ? 'translateY(-6px) scale(1.03)' : undefined,
    pointerEvents: passive ? 'none' : undefined,
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} style={style}>
        {content}
      </button>
    );
  }

  return (
    <div title={title} style={style}>
      {content}
    </div>
  );
}

export function dwarfMineCardTitle(card: GameCard): string {
  const def = card.def;
  if (def.kind === 'path') {
    let label = def.pathKind;
    if (def.doorColor) label += ` (${def.doorColor})`;
    if (def.crystals) label += ` 💎×${def.crystals}`;
    if (def.hasLadder) label += ' 🪜';
    return label;
  }
  return ACTION_META[def.actionKind]?.label ?? def.actionKind;
}
