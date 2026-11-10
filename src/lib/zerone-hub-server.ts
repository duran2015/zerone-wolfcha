const GAME_SEATS_PATH = "/api/v1/game-seats";

export function isZeroneHubMode(): boolean {
  return process.env.ZERONE_DEMO_MODE === "1" && process.env.ZERONE_HUB_MODE === "1";
}

export function isZeroneHubConfigured(): boolean {
  return Boolean(process.env.ZERONE_HUB_BASE_URL?.trim() && process.env.ZERONE_SERVICE_KEY?.trim());
}

export async function requestZeroneHub(path: string, init: RequestInit = {}): Promise<Response> {
  const base = process.env.ZERONE_HUB_BASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.ZERONE_SERVICE_KEY?.trim();
  if (!base || !key) throw new Error("Zerone Hub is not configured");
  if (!path.startsWith("/")) throw new Error("Invalid Zerone Hub path");
  return fetch(`${base}${GAME_SEATS_PATH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(90_000),
    cache: "no-store",
  });
}

export function isDemoGuest(request: Request): boolean {
  return request.headers.get("x-guest-id")?.startsWith("guest_") === true;
}
