# Wolfcha × Zerone 本地演示准备

## 启动

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# 在 .env.local 填写 OPENAI_COMPAT_BASE_URL、OPENAI_COMPAT_API_KEY、OPENAI_COMPAT_MODEL
pnpm dev
```

打开 <http://localhost:3000>。`OPENAI_COMPAT_BASE_URL` 应为 OpenAI 兼容 API 的 `/v1` 基础地址，不含 `/chat/completions`；密钥只留在本机 `.env.local`。`ZERONE_DEMO_MODE=1` 启用本地访客模式，游戏存档留在浏览器 localStorage。此模式不需要 Supabase、ZenMux、DashScope 或 TokenDance 账号。

当前阶段仍需实际模型服务和密钥才能完成 AI 对局；未配置时 `/api/chat` 返回 503。语音、Zerone 居民接入属于后续任务。
