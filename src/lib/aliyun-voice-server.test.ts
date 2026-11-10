import assert from "node:assert/strict";
import test from "node:test";
import { aliyunVoiceUrl, callAliyunVoice } from "./aliyun-voice-server";

test("百炼语音 API 地址只接受阿里云 HTTPS 域名", () => {
  const previous = process.env.ALIYUN_VOICE_BASE_URL;
  try {
    process.env.ALIYUN_VOICE_BASE_URL = "https://workspace.cn-beijing.maas.aliyuncs.com";
    assert.equal(aliyunVoiceUrl("/audio"), "https://workspace.cn-beijing.maas.aliyuncs.com/audio");
    process.env.ALIYUN_VOICE_BASE_URL = "https://aliyuncs.com.evil.example";
    assert.throws(() => aliyunVoiceUrl("/audio"));
    process.env.ALIYUN_VOICE_BASE_URL = "http://workspace.cn-beijing.maas.aliyuncs.com";
    assert.throws(() => aliyunVoiceUrl("/audio"));
  } finally {
    if (previous === undefined) delete process.env.ALIYUN_VOICE_BASE_URL;
    else process.env.ALIYUN_VOICE_BASE_URL = previous;
  }
});

test("百炼语音密钥只通过服务端 Authorization 发送", async () => {
  const previousKey = process.env.ALIYUN_VOICE_API_KEY;
  const previousBase = process.env.ALIYUN_VOICE_BASE_URL;
  const previousFetch = globalThis.fetch;
  let called = false;
  try {
    process.env.ALIYUN_VOICE_API_KEY = "test-secret";
    process.env.ALIYUN_VOICE_BASE_URL = "https://workspace.cn-beijing.maas.aliyuncs.com";
    globalThis.fetch = async (input, init) => {
      called = true;
      assert.equal(input, "https://workspace.cn-beijing.maas.aliyuncs.com/audio");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-secret");
      assert.equal(init?.body, JSON.stringify({ input: { text: "你好" } }));
      return new Response("{}", { status: 200 });
    };
    assert.equal((await callAliyunVoice("/audio", { input: { text: "你好" } })).status, 200);
    assert.equal(called, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ALIYUN_VOICE_API_KEY;
    else process.env.ALIYUN_VOICE_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.ALIYUN_VOICE_BASE_URL;
    else process.env.ALIYUN_VOICE_BASE_URL = previousBase;
  }
});
