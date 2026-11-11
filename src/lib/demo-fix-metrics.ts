"use client";

export type DemoFixMetric = "prefetchHits" | "retries" | "failures";

export function recordDemoFixMetric(gameId: string, metric: DemoFixMetric): void {
  if (typeof sessionStorage === "undefined") return;
  const key = `wolfcha_demo_fix_metrics_${gameId}`;
  try {
    const current = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<DemoFixMetric, number>;
    current[metric] = (current[metric] || 0) + 1;
    sessionStorage.setItem(key, JSON.stringify(current));
  } catch { /* metrics must not interrupt the game */ }
}
