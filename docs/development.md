# 开发指南

## 本地开发流程

1. 启动 PostgreSQL，确保 `DATABASE_URL` 正确
2. `pnpm install`
3. `pnpm db:push` 同步数据库表
4. `pnpm dev` 启动前后端

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/game_lobby` | PG 连接串 |
| `PORT` | `3001` | 服务端端口 |
| `JWT_SECRET` | `dev-secret-change-me` | JWT 密钥（生产必改） |
| `CORS_ORIGIN` | `http://localhost:5273` | 允许的前端源 |
| `VITE_API_URL` | `http://localhost:3001` | 前端 API 地址 |
| `VITE_WS_URL` | `http://localhost:3001` | 前端 WebSocket 地址 |

## 包依赖关系

```
web → shared
server → shared, db, game-engine
game-engine → shared
db → (standalone)
```

构建顺序：`shared` → `db` / `game-engine` → `server` / `web`

## 数据库操作

```bash
# 根据 schema 变更生成 SQL 迁移
pnpm db:generate

# 执行迁移
pnpm db:migrate

# 开发时快速同步（无迁移文件）
pnpm db:push
```

## 调试 Socket

1. 打开浏览器开发者工具 → Network → WS
2. 观察 `game:state`、`room:updated` 事件
3. 服务端日志在 `apps/server` 终端输出

## 代码规范

- TypeScript strict 模式
- 游戏逻辑放在 `game-engine`，保持可测试
- Socket 回调使用 Zod 校验入参
- UI 组件按页面/功能分目录

## 生产部署建议

1. 使用 `pnpm build` 构建
2. 服务端：`node apps/server/dist/index.js`
3. 前端：将 `apps/web/dist` 交由 Nginx/CDN 托管
4. 配置 HTTPS 与 WSS
5. 使用 Redis adapter 扩展 Socket.io 多实例（当前为单实例）

## 测试账号

开发环境可自行注册。建议用两个浏览器窗口登录不同账号测试多人联机。
