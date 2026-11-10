# Wolfcha × Zerone 本地演示

Wolfcha 的 AI 请求由服务端转发到 Zerone Hub 的 `/api/v1/game-seats`；Hub 再调用其后台已配置的模型。浏览器不接触 Hub 服务密钥或模型密钥。

## 1. 配置 Zerone Hub

先在 Hub 后台配置一个有 Provider 和模型的 Agent。可以复用现有 Agent。Hub 服务端设置：

```bash
export GAME_SEATS_SERVICE_KEY="$(openssl rand -hex 32)"
export GAME_SEATS_CALL_BUDGET=120
export WOLFCHA_TEMPLATE_AGENT_NAME='已有 Agent 的准确名称' # 可选；不填则使用第一个有模型配置的 Agent
```

在 Hub 工程执行 `go run ./cmd/seed-game-seats`，创建九名 Wolfcha 居民，再启动 Hub。详见 Hub 仓库的 `docs/game-seats-setup.md`。`GET /api/v1/game-seats/roster?gameKey=wolfcha` 应返回至少九名居民。

## 2. 配置 Wolfcha

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

在 `.env.local` 中设置：

```env
ZERONE_DEMO_MODE=1
NEXT_PUBLIC_ZERONE_DEMO_MODE=1
ZERONE_HUB_MODE=1
NEXT_PUBLIC_ZERONE_HUB_MODE=1
ZERONE_HUB_BASE_URL=http://localhost:8081
ZERONE_SERVICE_KEY=与Hub的GAME_SEATS_SERVICE_KEY相同的值
```

`ZERONE_HUB_BASE_URL` 是 Hub API 服务的根地址，不是 Zerone 后台网页地址；不要附加 `/api/v1/game-seats`。`ZERONE_SERVICE_KEY` 只留在本机或部署环境，不提交到 Git。此模式不需要填写 `OPENAI_COMPAT_*`、阿里云模型密钥、Supabase、ZenMux、DashScope 或 TokenDance 凭证。

运行 `pnpm dev` 并打开 <http://localhost:3000>。首页会检查 Hub 服务和九名居民是否就绪。Wolfcha 固定使用一名真人加九名 Zerone 居民的十人局；开局时创建 Hub session，后续按居民座位转发模型请求，并回写投票、出局及终局事件。浏览器刷新后仍可通过本地存档恢复 Hub session。

## 状态与边界

服务接口与本地模拟响应可测试；真实对局需 Hub 已配置模型和服务密钥后验收。旧的 `OPENAI_COMPAT_*` 直连模式仍可通过将 `ZERONE_HUB_MODE=0` 使用，但不参与 Zerone 接入验收。
