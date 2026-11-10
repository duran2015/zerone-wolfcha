export type AiActivity = {
  id: string;
  label: string;
  phase: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "success" | "error";
  detail?: string;
};

const activities: AiActivity[] = [];
const listeners = new Set<() => void>();
const STORAGE_KEY = "wolfcha_ai_activity";
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) activities.push(...saved.filter((item) => item && item.status !== "running").slice(-30));
  } catch { /* storage may be unavailable */ }
}

function publish() {
  if (typeof window !== "undefined") {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activities.slice(-30))); } catch { /* storage may be unavailable */ }
  }
  listeners.forEach((listener) => listener());
}

export function getAiActivities(): AiActivity[] {
  load();
  return activities.slice().reverse();
}

export function subscribeAiActivities(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startAiActivity(id: string, label: string, phase: string): void {
  if (typeof window === "undefined") return;
  load();
  activities.push({ id, label, phase, startedAt: Date.now(), status: "running" });
  if (activities.length > 30) activities.splice(0, activities.length - 30);
  publish();
}

export function finishAiActivity(id: string, status: "success" | "error", detail?: string): void {
  const activity = activities.findLast((item) => item.id === id && item.status === "running");
  if (!activity) return;
  activity.status = status;
  activity.endedAt = Date.now();
  activity.detail = detail;
  publish();
}
