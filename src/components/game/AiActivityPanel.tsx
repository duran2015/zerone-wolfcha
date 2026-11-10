"use client";

import { useEffect, useState } from "react";
import { getAiActivities, subscribeAiActivities, type AiActivity } from "@/lib/ai-activity";

const phaseLabels: Record<string, string> = {
  DAY_BADGE_SIGNUP: "警徽报名", DAY_BADGE_SPEECH: "警徽发言", DAY_BADGE_ELECTION: "警徽投票",
  DAY_SPEECH: "白天发言", DAY_VOTE: "白天投票", DAY_PK_SPEECH: "平票发言",
  NIGHT_WOLF_ACTION: "狼人行动", NIGHT_GUARD_ACTION: "守卫行动", NIGHT_WITCH_ACTION: "女巫行动",
  NIGHT_SEER_ACTION: "预言家行动", utility: "辅助判断",
};

function duration(activity: AiActivity, now: number) {
  return `${Math.max(0, Math.round(((activity.endedAt ?? now) - activity.startedAt) / 1000))} 秒`;
}

export function AiActivityPanel() {
  const [items, setItems] = useState<AiActivity[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const update = () => setItems(getAiActivities());
    update();
    const unsubscribe = subscribeAiActivities(update);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, []);

  const running = items.filter((item) => item.status === "running");
  const latest = running[0];

  return (
    <div className="fixed bottom-20 left-5 z-[80] max-w-[calc(100vw-2.5rem)] text-sm">
      {open && (
        <div className="mb-2 w-[360px] max-w-full max-h-[50vh] overflow-y-auto rounded-xl border border-[#b4945d]/60 bg-[#211e1b] p-4 text-[#eee2c9] shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <strong>AI 运行日志</strong>
            <button type="button" onClick={() => setOpen(false)} className="text-[#c8b99b] hover:text-white" aria-label="关闭 AI 运行日志">关闭</button>
          </div>
          <p className="mb-3 text-xs text-[#b8aa91]">仅显示请求状态和耗时，不显示密钥、身份牌或提示词。</p>
          {items.length === 0 ? <p className="text-[#b8aa91]">本页还没有 AI 请求。</p> : (
            <ol className="space-y-2">
              {items.slice(0, 20).map((item) => (
                <li key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.label} · {phaseLabels[item.phase] || item.phase}</span>
                    <span className={item.status === "error" ? "text-red-300" : item.status === "running" ? "text-amber-300" : "text-green-300"}>
                      {item.status === "running" ? "调用中" : item.status === "error" ? "失败" : "已响应"}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-[#b8aa91]">
                    <span>{new Date(item.startedAt).toLocaleTimeString("zh-CN", { hour12: false })}</span>
                    <span>{duration(item, now)}{item.detail ? ` · ${item.detail}` : ""}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-[#b4945d] bg-[#211e1b] px-4 py-2 text-[#eee2c9] shadow-lg hover:bg-[#322c25]"
        aria-expanded={open} aria-label="查看 AI 运行日志">
        {latest ? `AI 调用中 · ${latest.label} · ${duration(latest, now)}` : "AI 运行日志"}
      </button>
    </div>
  );
}
