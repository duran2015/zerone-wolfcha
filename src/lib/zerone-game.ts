import { getAuthHeaders } from "@/lib/auth-headers";
import type { GameState } from "@/types/game";

export interface ZeroneResident {
  characterId: string;
  name: string;
  avatarUrl: string;
  bio: string;
  voice: string;
}

type SeatBinding = { seat: number; characterId: string };
type ZeroneGameSession = { sessionId: string; seats: SeatBinding[] };
const STORAGE_KEY = "wolfcha_zerone_game_session";
const residentNames: Record<string, string> = { zhou: "老周", zhen: "阿珍", lin: "小林", chen: "陈伯", meimei: "美美", jie: "阿杰", xiaoyu: "小雨", laowu: "老吴", tang: "唐姐" };
let currentSession: ZeroneGameSession | null = null;
const sentEvents = new Set<number>();
let syncingEvents = false;
let pendingEventState: GameState | null = null;

export function isZeroneGameEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ZERONE_HUB_MODE === "1";
}

export function zeroneSeatLabel(seat: number): string {
  if (!currentSession && typeof localStorage !== "undefined") {
    try { currentSession = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as ZeroneGameSession | null; } catch { /* no session */ }
  }
  const characterId = currentSession?.seats.find((item) => item.seat === seat)?.characterId;
  return `${seat + 1}号${characterId ? ` ${residentNames[characterId] || characterId}` : ""}`;
}

export async function loadZeroneRoster(): Promise<ZeroneResident[]> {
  const response = await fetch("/api/zerone/roster", { headers: await getAuthHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`Zerone 居民列表获取失败 (${response.status})`);
  const roster: unknown = await response.json();
  if (!Array.isArray(roster) || roster.length < 9 || roster.some((item) =>
    !item || typeof item.characterId !== "string" || typeof item.name !== "string")) {
    throw new Error("Zerone 需要至少九名已配置的居民");
  }
  return roster as ZeroneResident[];
}

export async function startZeroneGame(playerName: string, seats: SeatBinding[]): Promise<string> {
  const response = await fetch("/api/zerone/sessions", {
    method: "POST", headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
    body: JSON.stringify({ playerName, seats }),
  });
  if (!response.ok) throw new Error(`Zerone 对局创建失败 (${response.status})`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || typeof (body as { sessionId?: unknown }).sessionId !== "string") {
    throw new Error("Zerone 对局响应缺少 sessionId");
  }
  currentSession = { sessionId: (body as { sessionId: string }).sessionId, seats };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
  return currentSession.sessionId;
}

export function clearZeroneGame(): void {
  currentSession = null;
  sentEvents.clear();
  pendingEventState = null;
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

export async function syncZeroneGameEvents(state: GameState): Promise<void> {
  if (!isZeroneGameEnabled()) return;
  if (syncingEvents) { pendingEventState = state; return; }
  if (!currentSession && typeof localStorage !== "undefined") {
    try { currentSession = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as ZeroneGameSession | null; } catch { /* no session */ }
  }
  const session = currentSession;
  if (!session) return;
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  const events: Array<{ seq: number; type: string; day: number; actorSeat?: number; targetSeat?: number; detail: string }> = [];
  state.voteRounds?.forEach((round, roundIndex) => {
    if (round.kind !== "execution") return;
    Object.entries(round.votes).forEach(([voterId, targetSeat], voterIndex) => {
      if (!Number.isInteger(targetSeat) || targetSeat < 0) return;
      const voter = playerById.get(voterId);
      events.push({ seq: roundIndex * 100 + voterIndex + 1, type: "vote", day: round.day,
        actorSeat: voter?.seat, targetSeat, detail: `${voter?.displayName || "玩家"}投票给${state.players[targetSeat]?.displayName || `${targetSeat + 1}号`}` });
    });
  });
  state.players.filter((player) => !player.alive).forEach((player) =>
    events.push({ seq: 10_000 + player.seat, type: "eliminated", day: state.day,
      targetSeat: player.seat, detail: `${player.displayName}出局` }));
  const human = state.players.find((player) => player.isHuman);
  state.messages.forEach((message, index) => {
    if (!human || message.isSystem || message.playerId !== human.playerId ||
        !message.phase?.startsWith("DAY_") || !message.content.trim()) return;
    events.push({ seq: 30_000 + index, type: "player_speech", day: message.day ?? state.day,
      actorSeat: human.seat, detail: `${human.displayName}公开发言：${message.content.slice(0, 500)}` });
  });
  if (state.winner) events.push({ seq: 20_000, type: "game_end", day: state.day, detail: `对局结束，${state.winner}阵营获胜` });
  syncingEvents = true;
  try {
    for (const event of events) {
      if (sentEvents.has(event.seq)) continue;
      const response = await fetch("/api/zerone/events", { method: "POST",
        headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
        body: JSON.stringify({ sessionId: session.sessionId, event }) });
      if (!response.ok) throw new Error(`Zerone 事件回写失败 (${response.status})`);
      sentEvents.add(event.seq);
    }
  } finally {
    syncingEvents = false;
    const next = pendingEventState;
    pendingEventState = null;
    if (next) await syncZeroneGameEvents(next);
  }
}

export function zeroneRequestContext(seat?: number, phase?: string): { headers: Record<string, string>; body: Record<string, unknown> } {
  if (!isZeroneGameEnabled()) return { headers: {}, body: {} };
  if (!currentSession && typeof localStorage !== "undefined") {
    try { currentSession = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as ZeroneGameSession | null; } catch { /* no session */ }
  }
  const binding = currentSession?.seats.find((item) => item.seat === seat);
  if (!currentSession || !binding) throw new Error("Zerone 对局尚未创建");
  return {
    headers: { "X-Zerone-Session-Id": currentSession.sessionId, "X-Zerone-Seat": String(binding.seat),
      "X-Zerone-Character-Id": binding.characterId, "X-Zerone-Phase": phase || "utility" },
    body: { zeroneSeat: binding.seat, zeroneCharacterId: binding.characterId, zeronePhase: phase || "utility" },
  };
}
