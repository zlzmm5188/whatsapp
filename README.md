# WhatsApp-IM

一个类微信的 Web IM（即时通讯）应用。第一期实现：注册/登录、加好友、单聊文字消息、在线实时推送、离线消息历史。

## 技术栈

- **Monorepo**: pnpm workspace
- **后端** (`apps/server`): [NestJS](https://nestjs.com/) + [Socket.IO](https://socket.io/) + [Prisma](https://www.prisma.io/) + SQLite（生产可切 PostgreSQL）+ JWT 认证
- **前端** (`apps/web`): [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + TypeScript + [Pinia](https://pinia.vuejs.org/) + [Vue Router](https://router.vuejs.org/) + [TailwindCSS](https://tailwindcss.com/)
- **共享类型** (`packages/shared`): 前后端共用的 TS 类型定义

## 目录结构

```
whatsapp/
├── apps/
│   ├── server/         # NestJS 后端
│   │   ├── prisma/     # 数据库 schema 与 migration
│   │   └── src/
│   │       ├── auth/   # 注册 / 登录 / JWT
│   │       ├── users/  # 用户资料 / 搜索
│   │       ├── friends/# 好友请求 / 好友关系
│   │       ├── messages/# 消息 REST API（历史消息、已读标记）
│   │       └── chat/   # Socket.IO 实时网关
│   └── web/            # Vue 3 前端
│       └── src/
│           ├── api/    # REST / Socket 客户端
│           ├── stores/ # Pinia 状态（auth / chat）
│           ├── pages/  # 登录 / 注册 / 聊天 / 通讯录 / 个人
│           └── components/
└── packages/
    └── shared/         # 前后端共用类型
```

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化后端数据库（SQLite，零配置）
pnpm --filter @im/server exec prisma migrate dev --name init

# 3. 启动后端（http://localhost:3001）
pnpm dev:server

# 4. 启动前端（http://localhost:5173）
pnpm dev:web
```

打开两个浏览器（或一个浏览器的隐身窗口 + 正常窗口），分别注册两个账号，互加好友，就能体验实时聊天。

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 同时启动前后端 |
| `pnpm dev:server` | 只启动后端 |
| `pnpm dev:web` | 只启动前端 |
| `pnpm build` | 构建所有 workspace |
| `pnpm lint` | 跑所有 workspace 的 lint |
| `pnpm typecheck` | 类型检查 |

## 后续计划

- [ ] 第二期：群聊、图片/表情消息
- [ ] 第三期：朋友圈/动态
- [ ] 第四期：大文件分片上传（TUS）
- [ ] 第五期：语音/视频通话（WebRTC）

## License

MIT
