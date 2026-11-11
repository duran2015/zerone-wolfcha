import assert from "node:assert/strict";
import test from "node:test";
import type { PrefetchedSpeech } from "./useDialogueManager";
import { isPrefetchCompatible } from "./useDialogueManager";

const prefetch: PrefetchedSpeech = {
  gameId: "game-1", contextKey: "prompt-1", playerId: "p3",
  phase: "DAY_BADGE_SPEECH", day: 1,
  segments: ["发言"], isComplete: true, createdAt: 1,
};

test("只有可见提示词内容相同时才复用 AI 预取发言", () => {
  assert.equal(isPrefetchCompatible(prefetch, {
    gameId: "game-1", contextKey: "prompt-1", playerId: "p3",
    phase: "DAY_BADGE_SPEECH", day: 1,
  }), true);
  assert.equal(isPrefetchCompatible(prefetch, {
    gameId: "game-1", contextKey: "different public speech", playerId: "p3",
    phase: "DAY_BADGE_SPEECH", day: 1,
  }), false);
});

test("不同对局或实际提示词不同，都不能复用预取", () => {
  assert.equal(isPrefetchCompatible(prefetch, { ...prefetch, gameId: "game-2" }), false);
  assert.equal(isPrefetchCompatible(prefetch, { ...prefetch, contextKey: "changed-role-or-votes" }), false);
});
