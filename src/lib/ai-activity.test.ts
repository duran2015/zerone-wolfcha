import assert from "node:assert/strict";
import test from "node:test";
import { clearAiActivities, finishAiActivity, getAiActivities, startAiActivity } from "./ai-activity";

test("同一逻辑发言的自动重试合并为一条活动记录", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } });

  try {
    const id = "speech:game:1:DAY_SPEECH:p4:0";
    startAiActivity(id, "4号 老吴", "DAY_SPEECH");
    finishAiActivity(id, "error", "请求已取消");
    startAiActivity(id, "4号 老吴", "DAY_SPEECH");
    finishAiActivity(id, "success", "流式完成");

    const records = getAiActivities().filter((item) => item.id === id);
    assert.equal(records.length, 1);
    assert.equal(records[0].status, "success");
    assert.equal(records[0].retryCount, 1);
    assert.equal(records[0].detail, "流式完成");

    const hedgeId = "speech:game:1:DAY_SPEECH:p6:0";
    startAiActivity(hedgeId, "6号 陈伯", "DAY_SPEECH");
    startAiActivity(hedgeId, "6号 陈伯", "DAY_SPEECH");
    finishAiActivity(hedgeId, "error", "请求已取消");
    let hedgeRecord = getAiActivities().find((item) => item.id === hedgeId);
    assert.equal(hedgeRecord?.status, "running");
    finishAiActivity(hedgeId, "success", "流式完成");
    hedgeRecord = getAiActivities().find((item) => item.id === hedgeId);
    assert.equal(hedgeRecord?.status, "success");
    assert.equal(hedgeRecord?.retryCount, 1);
    assert.equal(hedgeRecord?.detail, "流式完成");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});

test("新对局清空上一局的 Agent 活动记录", () => {
  clearAiActivities();
  assert.deepEqual(getAiActivities(), []);
});
