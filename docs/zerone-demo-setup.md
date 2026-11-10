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

## 3. 接入阿里云百炼语音

在 `.env.local` 中填写百炼 API Key，并设置业务空间对应的 API 根域名。密钥仅由 Wolfcha 服务端读取：

```env
NEXT_PUBLIC_ALIYUN_VOICE_ENABLED=1
ALIYUN_VOICE_API_KEY=你的百炼API密钥
ALIYUN_VOICE_BASE_URL=https://你的业务空间域名
ALIYUN_ASR_MODEL=qwen-audio-3.1-asr-flash
ALIYUN_TTS_MODEL=qwen-audio-3.1-tts-flash
ALIYUN_TTS_VOICE=longanhuan_v3.1
```

重新启动 Wolfcha。玩家按住麦克风录音，松开后由服务端调用百炼 ASR 并把文字放入输入框；九名 AI 居民的公开发言由 Wolfcha 服务端直接调用百炼 TTS，游戏内按原有音频队列播放。Hub 提供每个居民的音色 ID；种子数据为九人配置了不同的 `qwen-audio-3.1-tts-flash` 中文音色。未配置时不启用语音按钮和朗读。模型 ID、音色 ID 必须与所用百炼地域和模型相匹配；种子音色要求北京地域。

对局中，AI 的每次请求会带上当前角色可见的公开发言、票型和阶段信息。玩家公开发言还会作为事件写入 Hub 的居民记忆，供后续回合及下一局参考。夜间私密信息仍按角色权限隔离。

## 状态与边界

服务接口与本地模拟响应可测试；真实对局需 Hub 已配置模型和服务密钥后验收。旧的 `OPENAI_COMPAT_*` 直连模式仍可通过将 `ZERONE_HUB_MODE=0` 使用，但不参与 Zerone 接入验收。
