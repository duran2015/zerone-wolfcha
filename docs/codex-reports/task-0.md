# 任务 0 交付报告（待真实模型对局验收）

- 分支：`codex/task-0`
- PR：https://github.com/duran2015/zerone-wolfcha/pull/1（草稿）
- 最后提交：在该分支执行 `git rev-parse HEAD`；精确哈希同时写在 PR 描述中

## 从零运行

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# 在 .env.local 填写 OPENAI_COMPAT_BASE_URL、OPENAI_COMPAT_API_KEY、OPENAI_COMPAT_MODEL
pnpm dev
```

详见 [演示准备](../zerone-demo-setup.md)。

## 验收

| 条目 | 结果 | 证据 |
|---|---|---|
| 按文档启动并完整玩完一局 | 未通过 | Next.js 开发服务和首页已启动；缺真实 OpenAI 兼容模型密钥，尚未完成夜晚、白天、投票、胜负的实局。 |
| 页面不见支付、积分、登录入口 | 部分通过 | 本地演示首页 HTML 仅有 Wolfcha 和“AI 居民”，未含“赞助”“登录”“积分”；对局内页面待真实对局目视检查。 |
| 不需要 ZenMux、DashScope、TokenDance、Supabase 账号 | 通过（启动与模型协议测试） | `ZERONE_DEMO_MODE=1` 时 `/api/demo-config` 返回 active；本地模拟 OpenAI 兼容服务的普通、SSE、批量 `/api/chat` 均返回 200。 |
| 不提交密钥 | 通过 | 仅 `.env.example` 入库，`.env.local` 在 `.gitignore` 中；Git diff 未含真实密钥。 |

验证：`pnpm install --frozen-lockfile --offline` 通过；`pnpm test:single-player-context` 253 项通过；`tsc --noEmit` 和 `next build --webpack` 通过。本地模拟模型通过普通 JSON、SSE 和批量 HTTP 检查；模拟回答不能证明游戏格式解析与完整对局成功。

## 文件与原因

| 文件 | 说明 |
|---|---|
| `.env.example` | 仅保留本地演示和 OpenAI 兼容模型必需配置。 |
| `pnpm-workspace.yaml` | 明确允许锁文件依赖的构建脚本，确保新环境 `pnpm install` 成功。 |
| `src/app/api/chat/route.ts` | 演示开关下用服务端密钥代理 OpenAI 兼容模型，支持普通、SSE、批量响应。 |
| `src/app/page.tsx` | 本地演示不挂载 TokenPay 恢复弹窗。 |
| `src/components/game/WelcomeScreen.tsx` | 演示首页只呈现姓名和开局入口。 |
| `src/lib/api-auth.ts` | 演示模式用本地访客 ID 通过聊天鉴权与场次限制。 |
| `src/lib/demo-config.ts`、`src/lib/demo-config-server.ts` | 显式本地演示模式，避免从 Supabase 表读取开关。 |
| `src/lib/supabase.ts`、`src/lib/supabase-admin.ts` | 演示模式提供仅供初始化的占位地址，避免无 Supabase 配置时模块加载失败。 |
| `docs/zerone-demo-setup.md` | 记录从零启动命令及模型配置。 |

## 差异与已知问题

- OpenAI 兼容出口目前由本地演示开关启用，尚未加入常规模型选择器。
- Supabase SDK 仍会初始化，但本地演示主流程不依赖其账号；完整对局仍需实测。
- 真实模型密钥及完整对局验收待配置，任务 0 暂不标记完成。
