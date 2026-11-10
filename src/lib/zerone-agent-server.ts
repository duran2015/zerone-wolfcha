import { randomUUID } from "node:crypto";
import { publicAgentMemory } from "@/lib/zerone-agent-memory";
import { zeroneRunAsChatStream } from "@/lib/zerone-agent-stream";

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

const runtimeSessions = new Map<string, string>();

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
    const checks = await Promise.all(residents.map(async ([id]) => {
      const response = await fetch(agentUrl(seats[id]), { headers: { "x-api-key": seats[id].apiKey },
        signal: AbortSignal.timeout(5_000), cache: "no-store" });
      return response.ok;
    }));
    return checks.every(Boolean);
  } catch { return false; }
}

export async function requestZeroneAgent(input: {
  playerId: string; sessionId: string; seat: number; characterId: string; phase: string; messages: unknown[]; stream: boolean;
}): Promise<Response> {
  const resident = residents.find(([id]) => id === input.characterId);
  const runtime = runtimeSeats()[input.characterId];
  if (!runtime?.apiKey) throw new Error("Zerone resident Agent is not configured");
  if (!resident || !Number.isInteger(input.seat) || !Array.isArray(input.messages)) {
    throw new Error("Invalid resident request");
  }
  const message = JSON.stringify({
    role: "Wolfcha 游戏角色", seat: input.seat, character: resident[1], bio: resident[2], phase: input.phase,
    rules: "严格依据 messages 中该角色可见的上下文行动。公开发言、玩家的最新发言和票型都是证据；不能透露未公开的夜间信息。只输出原提示词要求的格式，不加解释或 Markdown。",
    publicMemory: await publicAgentMemory(input.playerId),
    messages: input.messages,
  });
  const sessionKey = `${input.sessionId}:${input.characterId}`;
  const runtimeSessionId = runtimeSessions.get(sessionKey);
  const upstream = await fetch(`${agentUrl(runtime)}/runs`, {
    method: "POST", headers: { "x-api-key": runtime.apiKey, "Content-Type": "application/json", Accept: input.stream ? "text/event-stream" : "application/json" },
    body: JSON.stringify({ message, ...(runtimeSessionId ? { sessionId: runtimeSessionId } : {}), stream: input.stream }),
    signal: AbortSignal.timeout(180_000), cache: "no-store",
  });
  if (!upstream.ok) return new Response(JSON.stringify({ error: `Zerone Agent returned HTTP ${upstream.status}` }), {
    status: upstream.status, headers: { "Content-Type": "application/json" },
  });
  if (input.stream) return zeroneRunAsChatStream(upstream, (sessionId) => runtimeSessions.set(sessionKey, sessionId));
  const result: unknown = await upstream.json();
  const returnedSessionId = result && typeof result === "object" ? (result as { sessionId?: unknown }).sessionId : undefined;
  if (typeof returnedSessionId === "string" && returnedSessionId) runtimeSessions.set(sessionKey, returnedSessionId);
  const text = result && typeof result === "object" ? (result as { text?: unknown }).text : undefined;
  if (typeof text !== "string" || !text.trim()) return new Response(JSON.stringify({ error: "Zerone Agent returned no text" }), {
    status: 502, headers: { "Content-Type": "application/json" },
  });
  const id = randomUUID();
  return Response.json({ id, object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }] });
}
