import { randomUUID } from "node:crypto";
import { publicAgentMemory } from "@/lib/zerone-agent-memory";
import { zeroneRunAsChatStream } from "@/lib/zerone-agent-stream";

export const ZERONE_SPEECH_TIMEOUT_MS = 120_000;
export const ZERONE_VOTE_TIMEOUT_MS = 120_000;
export const ZERONE_DECISION_TIMEOUT_MS = 90_000;

export function zeroneAgentTimeoutMs(phase: string): number {
  if (phase.includes("SPEECH") || phase === "DAY_LAST_WORDS") return ZERONE_SPEECH_TIMEOUT_MS;
  if (phase.includes("VOTE") || phase.includes("ELECTION")) return ZERONE_VOTE_TIMEOUT_MS;
  return ZERONE_DECISION_TIMEOUT_MS;
}

type RuntimeSeat = { name: string; url: string; apiKey: string };
function runtimeSeats(): Record<string, RuntimeSeat> {
  try {
    const value: unknown = JSON.parse(process.env.ZERONE_AGENTS_JSON || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, RuntimeSeat> : {};
  } catch { return {}; }
}

const residents = [
  ["zhou", "老周", "茶馆老板，稳重，爱和稀泥", "longshu_v3.1"],
  ["zhen", "阿珍", "本地记者，犀利多疑", "longjing_v3.1"],
  ["lin", "小林", "大学生，冲动直率", "longshao_v3.1"],
  ["chen", "陈伯", "退休警察，爱推理，讲证据", "longnan_v3.1"],
  ["meimei", "美美", "主播，情绪外放，喜欢带节奏", "longanhuan_v3.1"],
  ["jie", "阿杰", "程序员，话少，偏好逻辑", "longtian_v3.1"],
  ["xiaoyu", "小雨", "咖啡师，善于观察，说话温和", "longanlingxin_v3.1"],
  ["laowu", "老吴", "司机，见多识广", "longlaotie_v3.1"],
  ["tang", "唐姐", "社区医生，冷静细致", "guyunshu_v3.1"],
] as const;

export function isZeroneAgentConfigured(): boolean {
  const seats = runtimeSeats();
  return residents.every(([id]) => Boolean(seats[id]?.name && seats[id]?.url && seats[id]?.apiKey));
}

export function zeroneAgentRoster() {
  return residents.map(([characterId, name, bio, voice]) => ({ characterId, name, bio, voice, avatarUrl: "" }));
}

export function zeroneAgentSession() { return { sessionId: randomUUID() }; }

type ZeroneAgentRequestInput = {
  playerId: string;
  sessionId: string;
  seat: number;
  characterId: string;
  phase: string;
  messages: unknown[];
  stream: boolean;
  signal?: AbortSignal;
};

function agentUrl(seat: RuntimeSeat): URL {
  const base = seat.url?.trim().replace(/\/$/, "");
  const agent = seat.name?.trim();
  if (!base || !agent) throw new Error("Zerone Agent is not configured");
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Invalid Zerone Agent URL");
  }
  return new URL(`${url.origin}${url.pathname.replace(/\/$/, "")}/v1/agents/${encodeURIComponent(agent)}`);
}

export async function isZeroneAgentReady(): Promise<boolean> {
  if (!isZeroneAgentConfigured()) return false;
  try {
    const seats = runtimeSeats();
    // Nine concurrent detail requests can overload a small Runtime deployment.
    for (let index = 0; index < residents.length; index += 3) {
      const checks = await Promise.all(residents.slice(index, index + 3).map(async ([id]) => {
        const response = await fetch(agentUrl(seats[id]), { headers: { "x-api-key": seats[id].apiKey },
          signal: AbortSignal.timeout(10_000), cache: "no-store" });
        return response.ok;
      }));
      if (!checks.every(Boolean)) return false;
    }
    return true;
  } catch { return false; }
}

export async function createZeroneAgentRunRequest(input: ZeroneAgentRequestInput): Promise<{
  url: string;
  init: RequestInit;
}> {
  const resident = residents.find(([id]) => id === input.characterId);
  const runtime = runtimeSeats()[input.characterId];
  if (!runtime?.apiKey) throw new Error("Zerone resident Agent is not configured");
  if (!resident || !Number.isInteger(input.seat) || !Array.isArray(input.messages)) {
    throw new Error("Invalid resident request");
  }
  const message = JSON.stringify({
    role: "Wolfcha 游戏角色", seat: input.seat, character: resident[1], bio: resident[2], phase: input.phase,
    rules: "严格依据 messages 中该角色可见的上下文行动。公开发言、玩家的最新发言和票型都是证据；不能透露未公开的夜间信息。只输出原提示词要求的格式，不加解释或 Markdown。" +
      (input.phase.includes("SPEECH") || input.phase === "DAY_LAST_WORDS"
        ? " 发言聚焦一两条关键证据，最多三句、120 个汉字；不要逐个点评所有玩家。"
        : ""),
    publicMemory: process.env.ZERONE_CROSS_GAME_MEMORY === "1" ? await publicAgentMemory(input.playerId) : [],
    messages: input.messages,
  });
  return {
    url: `${agentUrl(runtime)}/runs`,
    init: {
      method: "POST", headers: { "x-api-key": runtime.apiKey, "Content-Type": "application/json", Accept: input.stream ? "text/event-stream" : "application/json" },
      // Wolfcha already supplies the role's visible game history in `messages`.
      // Reusing a Runtime session would append previous full snapshots again on every turn.
      body: JSON.stringify({ message, stream: input.stream }),
      // Cancel Runtime generation when the browser abandons a prefetch or times out.
      signal: input.signal
        ? AbortSignal.any([input.signal, AbortSignal.timeout(zeroneAgentTimeoutMs(input.phase))])
        : AbortSignal.timeout(zeroneAgentTimeoutMs(input.phase)),
      cache: "no-store",
    },
  };
}

export async function requestZeroneAgent(input: ZeroneAgentRequestInput): Promise<Response> {
  const request = await createZeroneAgentRunRequest(input);
  const upstream = await fetch(request.url, request.init);
  if (!upstream.ok) return new Response(JSON.stringify({ error: `Zerone Agent returned HTTP ${upstream.status}` }), {
    status: upstream.status, headers: {
      "Content-Type": "application/json",
      ...(upstream.headers.get("retry-after") ? { "Retry-After": upstream.headers.get("retry-after")! } : {}),
    },
  });
  if (input.stream) return zeroneRunAsChatStream(upstream, () => {});
  const result: unknown = await upstream.json();
  const text = result && typeof result === "object" ? (result as { text?: unknown }).text : undefined;
  if (typeof text !== "string" || !text.trim()) return new Response(JSON.stringify({ error: "Zerone Agent returned no text" }), {
    status: 502, headers: { "Content-Type": "application/json" },
  });
  const id = randomUUID();
  return Response.json({ id, object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }] });
}
