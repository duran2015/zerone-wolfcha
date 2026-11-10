import { NextResponse } from "next/server";
import { isDemoGuest, isZeroneHubMode, requestZeroneHub } from "@/lib/zerone-hub-server";

export async function GET(request: Request) {
  if (!isZeroneHubMode()) return NextResponse.json({ error: "Zerone Hub mode is disabled" }, { status: 404 });
  if (!isDemoGuest(request)) return NextResponse.json({ error: "Demo guest ID required" }, { status: 401 });
  try {
    const response = await requestZeroneHub("/roster?gameKey=wolfcha");
    if (!response.ok) return NextResponse.json({ error: `Zerone roster returned HTTP ${response.status}` }, { status: 502 });
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("[zerone-hub] roster request failed", error);
    return NextResponse.json({ error: "Zerone roster unavailable" }, { status: 502 });
  }
}
