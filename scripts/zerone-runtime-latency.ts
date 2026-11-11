import { createZeroneAgentRunRequest } from "../src/lib/zerone-agent-server";

type Sample = {
  run: number;
  status: number | string;
  firstByteMs: number | null;
  firstSegmentMs: number | null;
  totalMs: number;
};

const RUNS = 15;
const characterId = process.argv[2] || "chen";
const context = [
  { role: "system", content: "第1天白天发言阶段。8人局，存活8人。你是4号居民，轮到你公开发言。" },
  { role: "user", content: "1号：我暂时相信3号，想听后置位补充。\n2号：1号太保守，我更怀疑6号。\n3号真人玩家：我觉得2号和6号里至少有一个坏人，今天先听完再投。\n请依据当前可见信息完成本轮公开发言。" },
];

function percentile(values: number[], ratio: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function metric(samples: Sample[], key: "firstByteMs" | "firstSegmentMs" | "totalMs") {
  const values = samples.map((sample) => sample[key]).filter((value): value is number => typeof value === "number");
  return { p50: percentile(values, 0.5), p90: percentile(values, 0.9), max: values.length ? Math.max(...values) : null };
}

async function runOnce(run: number): Promise<Sample> {
  const startedAt = performance.now();
  let firstByteMs: number | null = null;
  let firstSegmentMs: number | null = null;
  let status: number | string = "NETWORK_ERROR";
  try {
    const request = await createZeroneAgentRunRequest({
      playerId: "guest_runtime_latency_audit",
      sessionId: `latency-audit-${Date.now()}-${run}`,
      seat: 4,
      characterId,
      phase: "DAY_SPEECH",
      messages: context,
      stream: true,
    });
    const response = await fetch(request.url, request.init);
    status = response.status;
    if (!response.body) return { run, status, firstByteMs, firstSegmentMs, totalMs: Math.round(performance.now() - startedAt) };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstByteMs === null) firstByteMs = Math.round(performance.now() - startedAt);
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      if (firstSegmentMs === null && events.some((event) => {
        const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) return false;
        try {
          const parsed = JSON.parse(data) as { partial?: { text?: unknown }; text?: unknown };
          return (typeof parsed.partial?.text === "string" && parsed.partial.text.length > 0)
            || (typeof parsed.text === "string" && parsed.text.length > 0);
        } catch { return false; }
      })) firstSegmentMs = Math.round(performance.now() - startedAt);
    }
  } catch (error) {
    status = error instanceof Error ? error.name : "UNKNOWN_ERROR";
  }
  return { run, status, firstByteMs, firstSegmentMs, totalMs: Math.round(performance.now() - startedAt) };
}

async function main() {
  const samples: Sample[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const sample = await runOnce(run);
    samples.push(sample);
    console.log(`${run}\t${sample.status}\t${sample.firstByteMs ?? "-"}\t${sample.firstSegmentMs ?? "-"}\t${sample.totalMs}`);
  }

  console.log(JSON.stringify({
    characterId,
    runs: RUNS,
    success: samples.filter((sample) => sample.status === 200).length,
    firstByteMs: metric(samples, "firstByteMs"),
    firstSegmentMs: metric(samples, "firstSegmentMs"),
    totalMs: metric(samples, "totalMs"),
  }, null, 2));
}

void main();
