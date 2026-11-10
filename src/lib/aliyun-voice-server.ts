const DEFAULT_BASE = "https://dashscope.aliyuncs.com";

export function isAliyunVoiceConfigured(): boolean {
  return Boolean(process.env.ALIYUN_VOICE_API_KEY?.trim());
}

export function aliyunVoiceUrl(path: string): string {
  const base = (process.env.ALIYUN_VOICE_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
  const url = new URL(base);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".aliyuncs.com")) {
    throw new Error("Invalid Aliyun voice API origin");
  }
  return `${url.origin}${path}`;
}

export async function callAliyunVoice(path: string, body: unknown): Promise<Response> {
  const key = process.env.ALIYUN_VOICE_API_KEY?.trim();
  if (!key) throw new Error("Aliyun voice API key is not configured");
  return fetch(aliyunVoiceUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-DashScope-SSE": "disable" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
}
