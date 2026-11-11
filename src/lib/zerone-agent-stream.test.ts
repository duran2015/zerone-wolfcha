import assert from "node:assert/strict";
import test from "node:test";
import { zeroneRunAsChatStream } from "@/lib/zerone-agent-stream";

const decoder = new TextDecoder();

test("Runtime 长时间没有文字时持续向浏览器发送 SSE 心跳", async () => {
  const upstream = new Response(new ReadableStream<Uint8Array>({
    start() {},
  }));
  const response = zeroneRunAsChatStream(upstream, () => {}, 5);
  const reader = response.body!.getReader();
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.match(decoder.decode(first.value), /^: ping\n\n$/);
  await reader.cancel();
});

test("Runtime 非文字事件也会刷新浏览器流", async () => {
  const encoder = new TextEncoder();
  const upstream = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('event: system\ndata: {"sessionId":"session-1"}\n\n'));
      controller.close();
    },
  }));
  const response = zeroneRunAsChatStream(upstream, () => {}, 60_000);
  const text = await response.text();
  assert.match(text, /: ping\n\n/);
  assert.match(text, /data: \[DONE\]/);
});
