import { NextResponse } from "next/server";
import { isDemoGuest, isZeroneHubMode, requestZeroneHub } from "@/lib/zerone-hub-server";
import { isZeroneAgentConfigured, zeroneAgentSession } from "@/lib/zerone-agent-server";

export async function POST(request: Request) {
  if (!isZeroneHubMode()) return NextResponse.json({ error: "Zerone Hub mode is disabled" }, { status: 404 });
  if (!isDemoGuest(request)) return NextResponse.json({ error: "Demo guest ID required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid session request" }, { status: 400 });
  const input = body as { playerName?: unknown; seats?: unknown };
  const allowedSeatCounts = process.env.ZERONE_DEMO_MODE === "1" ? [7, 8, 9] : [9];
  if (typeof input.playerName !== "string" || !Array.isArray(input.seats) || !allowedSeatCounts.includes(input.seats.length) ||
      !input.seats.every((seat) => seat && Number.isInteger(seat.seat) && typeof seat.characterId === "string")) {
    return NextResponse.json({ error: "Invalid AI seat count" }, { status: 400 });
  }
  if (isZeroneAgentConfigured()) return NextResponse.json(zeroneAgentSession(), { status: 201 });
  try {
    const response = await requestZeroneHub("/sessions", {
      method: "POST",
      body: JSON.stringify({ gameKey: "wolfcha", playerId: request.headers.get("x-guest-id"), playerName: input.playerName, seats: input.seats }),
    });
    if (!response.ok) return NextResponse.json({ error: `Zerone session returned HTTP ${response.status}` }, { status: 502 });
    return NextResponse.json(await response.json(), { status: 201 });
  } catch (error) {
    console.error("[zerone-hub] session request failed", error);
    return NextResponse.json({ error: "Zerone session unavailable" }, { status: 502 });
  }
}
