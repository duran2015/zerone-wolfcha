import assert from "node:assert/strict";
import test from "node:test";
import { isZeroneAgentConfigured, requestZeroneAgent, zeroneAgentRoster } from "./zerone-agent-server";

test("九个居民分别路由到自己的 Zerone Agent，且保留当前角色上下文", async () => {
  const oldConfig = process.env.ZERONE_AGENTS_JSON;
  const oldFetch = globalThis.fetch;
  const roster = zeroneAgentRoster();
  const config = Object.fromEntries(roster.map((resident) => [resident.characterId, {
    name: `wolfcha-${resident.characterId}`, url: `https://agents.example.test/${resident.characterId}`,
    apiKey: `secret-${resident.characterId}`,
  }]));
  const seen: string[] = [];
  try {
    process.env.ZERONE_AGENTS_JSON = JSON.stringify(config);
    assert.equal(isZeroneAgentConfigured(), true);
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const characterId = url.split("/")[3];
      seen.push(characterId);
      assert.equal(new Headers(init?.headers).get("x-api-key"), `secret-${characterId}`);
      const body = JSON.parse(String(init?.body));
      if (seen.filter((id) => id === characterId).length === 1) assert.equal(body.sessionId, undefined);
      else assert.equal(body.sessionId, `runtime-${characterId}`);
      assert.equal(JSON.parse(body.message).messages[0].content, "玩家公开发言：先看票型");
      return Response.json({ text: `${characterId}的判断`, sessionId: `runtime-${characterId}` });
    };
    for (const [index, resident] of roster.entries()) {
      const response = await requestZeroneAgent({ sessionId: "11111111-1111-4111-8111-111111111111",
        playerId: "guest_testplayer123",
        seat: index + 1, characterId: resident.characterId, phase: "DAY_SPEECH",
        messages: [{ role: "user", content: "玩家公开发言：先看票型" }], stream: false });
      assert.equal(response.status, 200);
      assert.match(JSON.stringify(await response.json()), new RegExp(`${resident.characterId}的判断`));
    }
    assert.equal(new Set(seen).size, 9);
    const stream = await requestZeroneAgent({ sessionId: "11111111-1111-4111-8111-111111111111",
      playerId: "guest_testplayer123",
      seat: 1, characterId: "zhou", phase: "DAY_SPEECH", messages: [{ role: "user", content: "玩家公开发言：先看票型" }], stream: true });
    assert.match(await stream.text(), /chat\.completion\.chunk/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldConfig === undefined) delete process.env.ZERONE_AGENTS_JSON;
    else process.env.ZERONE_AGENTS_JSON = oldConfig;
  }
});
