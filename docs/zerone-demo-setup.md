# Wolfcha × Zerone 本地演示

首选接法与 Beadloop 手串小程序一致：Wolfcha 服务端通过独立运行密钥调用 Zerone Agent Runtime 的 `/v1/agents/{name}/runs`。九名居民各有一个 Agent、运行地址和密钥。Wolfcha 保留狼人杀规则、阶段提示词和角色可见上下文；浏览器不接触 Agent 密钥。旧的 Hub `game-seats` 适配器仍可用于已有部署。

## 首选：九名独立 Zerone Agent

在 Zerone 部署 `wolfcha-zhou`、`wolfcha-zhen`、`wolfcha-lin`、`wolfcha-chen`、`wolfcha-meimei`、`wolfcha-jie`、`wolfcha-xiaoyu`、`wolfcha-laowu`、`wolfcha-tang`。服务端 `.env.local` 使用一行 `ZERONE_AGENTS_JSON` 保存九人映射，每项包含 `name`、`url`（Runtime 根地址）和 `apiKey`（该 Agent 的独立运行密钥）。`ZERONE_DEMO_MODE`、`NEXT_PUBLIC_ZERONE_DEMO_MODE`、`ZERONE_HUB_MODE`、`NEXT_PUBLIC_ZERONE_HUB_MODE` 均设为 `1`。此路径不需要 `ZERONE_HUB_BASE_URL` 或 `ZERONE_SERVICE_KEY`。每次模型请求按座位路由到相应 Agent，并携带该角色可见的本局上下文；每次请求独立运行，不复用 Runtime 会话。演示默认 `ZERONE_CROSS_GAME_MEMORY=0`，不读取本机跨局公开记忆；事件仍可写入本机 `.data/zerone-agent-public-memory.json`。

## 旧路径：配置 Zerone Hub 游戏座位接口

先在 Hub 后台配置一个有 Provider 和模型的 Agent。可以复用现有 Agent。Hub 服务端设置：

```bash
export GAME_SEATS_SERVICE_KEY="$(openssl rand -hex 32)"
export GAME_SEATS_CALL_BUDGET=120
export WOLFCHA_TEMPLATE_AGENT_NAME='已有 Agent 的准确名称' # 可选；不填则使用第一个有模型配置的 Agent
```

在 Hub 工程执行 `go run ./cmd/seed-game-seats`，创建九名 Wolfcha 居民，再启动 Hub。详见 Hub 仓库的 `docs/game-seats-setup.md`。`GET /api/v1/game-seats/roster?gameKey=wolfcha` 应返回至少九名居民。

## 2. 配置 Wolfcha（Runtime 路径）

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
ZERONE_CROSS_GAME_MEMORY=0
ZERONE_AGENTS_JSON={"character-id":{"name":"Agent准确名称","url":"Runtime根地址","apiKey":"独立运行密钥"}}
```

`ZERONE_AGENTS_JSON` 必须覆盖九名居民；准确的 character ID 以 `.env.example` 和启动就绪检查为准。每项 `url` 是已部署 Agent 的 Runtime 根地址，`apiKey` 是该 Agent 的运行密钥。它们只留在 `.env.local`，不要提交到 Git。Runtime 路径不需要 `ZERONE_HUB_BASE_URL`、`ZERONE_SERVICE_KEY`、`OPENAI_COMPAT_*`、Supabase、ZenMux、DashScope 或 TokenDance 凭证。

演示时运行 `pnpm dev` 并打开 <http://127.0.0.1:3000/zh>。`dev` 和 `start` 脚本都仅监听本机 `127.0.0.1`。首页会检查九个 Runtime Agent 是否就绪。Wolfcha 固定使用一名真人加九名 Zerone 居民的十人局；模型请求按座位转发到各自 Runtime，投票、出局及终局事件仍由 Wolfcha 记录。浏览器刷新后通过本地对局存档恢复，不依赖 Hub session。

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

重新启动 Wolfcha。玩家点击“语音输入”开始录音，再次点击停止；服务端调用百炼 ASR，并把识别文字放入输入框，玩家确认后点击“发送”。九名 AI 居民的公开发言由 Wolfcha 服务端直接调用百炼 TTS，按游戏音频队列播放。每个居民的 persona 配置独立音色 ID；未单独配置时按年龄、性别和性格选择默认音色。模型 ID、音色 ID 必须与所用百炼地域和模型相匹配。

对局中，AI 的每次请求会带上当前角色可见的公开发言、票型和阶段信息。事件可写入本机居民记忆；演示默认 `ZERONE_CROSS_GAME_MEMORY=0`，下一局不会读取上一局内容。夜间私密信息仍按角色权限隔离。

## 状态与边界

服务接口与本地模拟响应只能用于开发测试；最终验收必须使用九个真实 Runtime Agent 和真实浏览器麦克风。旧 Hub 座位接口和 `OPENAI_COMPAT_*` 直连模式仍保留兼容，但不参与本次 Zerone Runtime 验收。
