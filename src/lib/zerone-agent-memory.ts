import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type MemoryEntry = { key: string; detail: string };
type MemoryFile = Record<string, MemoryEntry[]>;
const PATH = join(process.cwd(), ".data", "zerone-agent-public-memory.json");
let writeQueue = Promise.resolve();

async function load(): Promise<MemoryFile> {
  try {
    const value: unknown = JSON.parse(await readFile(PATH, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value as MemoryFile : {};
  } catch { return {}; }
}

export async function publicAgentMemory(playerId: string): Promise<string[]> {
  if (!/^guest_[a-zA-Z0-9_-]{8,100}$/.test(playerId)) return [];
  await writeQueue;
  const data = await load();
  return (data[playerId] || []).slice(-12).map((entry) => entry.detail);
}

export async function recordPublicAgentEvent(playerId: string, sessionId: string, event: unknown): Promise<void> {
  if (!/^guest_[a-zA-Z0-9_-]{8,100}$/.test(playerId) || !event || typeof event !== "object") return;
  const item = event as { seq?: unknown; type?: unknown; day?: unknown; detail?: unknown };
  if (!["player_speech", "vote", "eliminated", "game_end"].includes(String(item.type)) ||
      typeof item.seq !== "number" || !Number.isInteger(item.seq) || typeof item.detail !== "string" || !item.detail.trim()) return;
  const key = `${sessionId}:${item.seq}`;
  const detail = `第${typeof item.day === "number" && Number.isInteger(item.day) ? item.day : "?"}天 ${item.detail.slice(0, 500)}`;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const data = await load();
    const entries = data[playerId] || [];
    if (entries.some((entry) => entry.key === key)) return;
    data[playerId] = [...entries, { key, detail }].slice(-30);
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    await writeFile(PATH, JSON.stringify(data), { mode: 0o600 });
  });
  await writeQueue;
}
