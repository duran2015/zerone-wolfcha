# 任务 2：Wolfcha 对接 Zerone Hub

- 分支：`codex/task-0`
- 状态：Wolfcha 对接代码已写；等待 Zerone Hub 配置及真实完整对局验收。

## 已实现

- 通过服务端代理 Hub roster、session、generate 和 event 接口；服务密钥不会发给浏览器。
- 本地演示使用一名真人和九名固定居民；每局创建 Hub session，每次 AI 请求携带对应座位、居民、阶段。
- 支持普通、流式和批量模型请求；投票、出局及终局事件回写 Hub，供跨局记忆使用。
- 首页检查 Hub 可用性及九名居民，未就绪时禁用开局。
- 可在 Hub 指定已有 Agent 作为九名居民的模型模板。

## 待验收

- 用户配置 Hub Provider/Agent、`GAME_SEATS_SERVICE_KEY`，并执行居民种子命令。
- 验证 roster、创建 session、真实模型输出、夜晚至胜负完整对局、事件和跨局记忆。

配置方法见 [演示准备](../zerone-demo-setup.md)。
