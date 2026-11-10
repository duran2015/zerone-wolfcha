import assert from "node:assert/strict";
import test from "node:test";
import { isZeroneAgentConfigured, requestZeroneAgent, zeroneAgentRoster } from "./zerone-agent-server";
import { zeroneResidentMind } from "./zerone-resident-minds";

test("九位 Zerone 居民有各自稳定的记忆和推理风格", () => {
  const minds = zeroneAgentRoster().map(({ characterId }) => zeroneResidentMind(characterId));
  assert.equal(minds.length, 9);
  assert.ok(minds.every((mind) => mind?.memoryBias && mind.logicDepth && mind.suspicionThreshold));
  assert.equal(new Set(minds.map((mind) => mind?.memoryBias)).size, 9);
});

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
      assert.equal(body.sessionId, undefined);
      assert.equal(JSON.parse(body.message).messages[0].content, "玩家公开发言：先看票型");
      if (body.stream) {
        assert.equal(new Headers(init?.headers).get("Accept"), "text/event-stream");
        return new Response(`event: system\ndata: {"sessionId":"runtime-${characterId}"}\n\nevent: partial_message\ndata: {"partial":{"type":"text","text":"先看"}}\n\nevent: partial_message\ndata: {"partial":{"type":"text","text":"票型"}}\n\nevent: result\ndata: {"subtype":"success","text":"先看票型"}\n\nevent: done\ndata: {}\n\n`,
          { headers: { "Content-Type": "text/event-stream" } });
      }
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
    const streamText = await stream.text();
    assert.match(streamText, /chat\.completion\.chunk/);
    assert.equal((streamText.match(/先看/g) || []).length, 1);
    assert.equal((streamText.match(/票型/g) || []).length, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldConfig === undefined) delete process.env.ZERONE_AGENTS_JSON;
    else process.env.ZERONE_AGENTS_JSON = oldConfig;
  }
});
