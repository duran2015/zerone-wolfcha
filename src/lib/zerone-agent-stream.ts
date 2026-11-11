import { randomUUID } from "node:crypto";

/** Convert Zerone Runtime SSE text deltas to the OpenAI SSE format used by Wolfcha. */
export function zeroneRunAsChatStream(
  upstream: Response,
  onSession: (sessionId: string) => void,
  heartbeatMs = 15_000,
): Response {
  if (!upstream.body) return Response.json({ error: "Zerone Agent returned no stream" }, { status: 502 });
  const reader = upstream.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const id = randomUUID();
  let sentText = false;

  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cancelled = false;
      const send = (value: string) => {
        if (cancelled) return;
        try { controller.enqueue(encoder.encode(value)); } catch { cancelled = true; }
      };
      const sendHeartbeat = () => send(": ping\n\n");
      const heartbeat = setInterval(sendHeartbeat, heartbeatMs);
      const sendText = (content: string) => {
        if (!content) return;
        sentText = true;
        send(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`);
      };
      const processFrame = (frame: string) => {
        const event = frame.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) return;
        let value: Record<string, unknown>;
        try { value = JSON.parse(data); } catch { return; }
        // Runtime can emit status/tool events for a long time before the first text.
        // Forward a comment so the browser's idle timeout measures a dead connection,
        // not a healthy Agent that is still reasoning.
        sendHeartbeat();
        if (event === "system" && typeof value.sessionId === "string") onSession(value.sessionId);
        if (event === "partial_message") {
          const partial = value.partial && typeof value.partial === "object" ? value.partial as Record<string, unknown> : null;
          if (partial?.type === "text" && typeof partial.text === "string") sendText(partial.text);
        }
        if (event === "result") {
          if (typeof value.sessionId === "string") onSession(value.sessionId);
          if (typeof value.subtype === "string" && value.subtype.startsWith("error_")) {
            send(`data: ${JSON.stringify({ error: { message: "Zerone Agent 生成失败" } })}\n\n`);
          } else if (!sentText && typeof value.text === "string") sendText(value.text);
        }
        if (event === "error") send(`data: ${JSON.stringify({ error: { message: "Zerone Agent 流式请求失败" } })}\n\n`);
      };

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            processFrame(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) processFrame(buffer);
      } catch {
        send(`data: ${JSON.stringify({ error: { message: "Zerone Agent 连接中断" } })}\n\n`);
      } finally {
        clearInterval(heartbeat);
        send(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
        send("data: [DONE]\n\n");
        controller.close();
        reader.releaseLock();
      }
    },
    async cancel() { await reader.cancel().catch(() => {}); },
  });
  return new Response(output, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
