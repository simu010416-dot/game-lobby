# 矮人矿坑（Saboteur + Saboteur 2）

## 模式选择

房主在房间开局前于 **RoomSettings** 选择：

| 模式 | 说明 |
|------|------|
| `base` | 基本版 Saboteur：好矮人 vs 坏矮人 |
| `expansion` | Saboteur 2 扩展：绿/蓝队、Boss、Profiteer、地质学家及新通道/行动卡 |

通过 `game:start` 传递 `{ dwarfMineMode: 'base' | 'expansion' }`。

## 基本版规则摘要

- 3–10 人，3 轮累计金块
- 每轮随机分配好/坏矮人身份（人数见官方表）
- 回合：出通道卡 / 出行动卡 / 弃 1 张 → 抽 1 张
- 工具（灯、镐、矿车）损坏时不能出通道卡
- 好矮人连通金矿则胜并分配金块；牌堆耗尽未找到金矿则坏矮人胜

## 扩展版差异

- 固定 6 张手牌；每轮开始前从牌库移除 10 张
- 绿/蓝淘金队、Boss、Profiteer、地质学家、坏矮人
- 新通道：桥梁、双弯、梯子、带门通道、水晶
- 新行动：偷窃、Hands Off、换手、查验、换帽、囚禁、释放
- 回合四选一：出通道 / 出行动 / 弃 2 张移除面前卡 / Pass（弃 1–3 抽同数）
- 分金后偷窃阶段

## 阶段

`playing` → `map_peek` / `role_peek` → `gold_distribution` → `theft_resolution`（扩展）→ `round_end` → 下一轮或 `ended`

## Socket 事件

| 方向 | 事件 | 说明 |
|------|------|------|
| C→S | `game:dwarf_mine:play_path` | `{ cardId, row, col, rotation }` |
| C→S | `game:dwarf_mine:play_action` | `{ cardId, targetPlayerId?, collapseRow?, collapseCol? }` |
| C→S | `game:dwarf_mine:discard` | 基本版弃 1 张 |
| C→S | `game:dwarf_mine:discard_two` | 扩展版弃 2 张移除面前卡 |
| C→S | `game:dwarf_mine:pass` | 扩展版 `{ cardIds }` |
| C→S | `game:dwarf_mine:map_peek` | `{ goalIndex }` |
| C→S | `game:dwarf_mine:role_peek_continue` | 查验后继续 |
| C→S | `game:dwarf_mine:pick_gold` | `{ goldIndex }` |
| C→S | `game:dwarf_mine:steal_gold` | 扩展版 `{ targetId }` |
| C→S | `game:dwarf_mine:skip_steal` | 跳过偷窃 |
| C→S | `game:dwarf_mine:continue` | 进入下一轮 |
| S→C | `game:state` | 按玩家脱敏 |

## 状态脱敏

`requiresPerPlayerState: true`：他人手牌与身份隐藏；地图/查验结果仅发起者可见；轮末揭示身份。

## 人数与 Bot

- 最少 3 人，最多 10 人
- 不支持电脑玩家

## 相关代码

- 逻辑：`packages/games/dwarf-mine/src/`
- UI：`apps/web/src/games/dwarf-mine/`
- 服务端 Socket：`apps/server/src/games/dwarf-mine/socket.ts`
