import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CONFIG } from "@/lib/game-constants";

test("警徽和放逐投票最多并发三个 Agent", () => {
  assert.equal(GAME_CONFIG.AI_VOTE_CONCURRENCY, 3);
});
