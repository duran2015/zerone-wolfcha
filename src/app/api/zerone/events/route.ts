import { NextResponse } from "next/server";
import { isDemoGuest, isZeroneHubMode, requestZeroneHub } from "@/lib/zerone-hub-server";
import { isZeroneAgentConfigured } from "@/lib/zerone-agent-server";
import { recordPublicAgentEvent } from "@/lib/zerone-agent-memory";

export async function POST(request: Request) {
  if (!isZeroneHubMode()) return NextResponse.json({ error: "Zerone Hub mode is disabled" }, { status: 404 });
  if (!isDemoGuest(request)) return NextResponse.json({ error: "Demo guest ID required" }, { status: 401 });
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const { sessionId, event } = input as { sessionId?: unknown; event?: unknown };
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId) || !event || typeof event !== "object") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (isZeroneAgentConfigured()) {
    await recordPublicAgentEvent(request.headers.get("x-guest-id") || "", sessionId, event);
    return NextResponse.json({ ok: true });
  }
  try {
    const response = await requestZeroneHub(`/sessions/${sessionId}/events`, { method: "POST", body: JSON.stringify(event) });
    if (!response.ok) return NextResponse.json({ error: `Zerone event returned HTTP ${response.status}` }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[zerone-hub] event request failed", error);
    return NextResponse.json({ error: "Zerone event unavailable" }, { status: 502 });
  }
}
