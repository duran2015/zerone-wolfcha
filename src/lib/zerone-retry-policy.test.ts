import assert from "node:assert/strict";
import test from "node:test";
import { zeroneAttemptLimit } from "@/lib/zerone-retry-policy";

test("Zerone 发言只由对冲重试，非流式决策允许原 Agent 重试", () => {
  assert.equal(zeroneAttemptLimit(true, true, 4), 1);
  assert.equal(zeroneAttemptLimit(true, false, 4), 4);
  assert.equal(zeroneAttemptLimit(false, false, 4), 4);
});
