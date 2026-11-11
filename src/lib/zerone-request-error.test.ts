import assert from "node:assert/strict";
import test from "node:test";
import { classifyZeroneRequestError } from "./zerone-request-error";

test("Wolfcha 45 秒超时返回 504，并明确标注本地超时", () => {
  const failure = classifyZeroneRequestError(new DOMException("timed out", "TimeoutError"), 45_000);
  assert.deepEqual(failure, {
    status: 504,
    type: "wolfcha_timeout",
    error: "Zerone Agent timed out after 45s",
  });
});

test("浏览器 AbortError 同样归为 Wolfcha 超时，而不是 Runtime 502", () => {
  const failure = classifyZeroneRequestError(new DOMException("aborted", "AbortError"), 120_000);
  assert.equal(failure.status, 504);
  assert.equal(failure.type, "wolfcha_timeout");
  assert.match(failure.error, /120s/);
});

test("非超时异常才归为 Wolfcha 网关异常 502", () => {
  const failure = classifyZeroneRequestError(new TypeError("socket closed"), 90_000);
  assert.deepEqual(failure, {
    status: 502,
    type: "wolfcha_gateway_error",
    error: "Zerone Agent request failed: TypeError",
  });
});
