"use client";

import { useEffect, useState } from "react";
import { getAiActivities, subscribeAiActivities, type AiActivity } from "@/lib/ai-activity";

const phaseLabels: Record<string, string> = {
  DAY_BADGE_SIGNUP: "警徽报名", DAY_BADGE_SPEECH: "警徽发言", DAY_BADGE_ELECTION: "警徽投票",
  DAY_SPEECH: "白天发言", DAY_VOTE: "放逐投票", DAY_PK_SPEECH: "平票发言",
  NIGHT_WOLF_ACTION: "狼人行动", NIGHT_GUARD_ACTION: "守卫行动", NIGHT_WITCH_ACTION: "女巫行动",
  NIGHT_SEER_ACTION: "预言家行动", utility: "辅助判断",
};

function duration(activity: AiActivity, now: number) {
  return `${Math.max(0, Math.round(((activity.endedAt ?? now) - activity.startedAt) / 1000))} 秒`;
}

export function AiActivityPanel() {
  const [items, setItems] = useState<AiActivity[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const update = () => { setItems(getAiActivities()); setNow(Date.now()); };
    update();
    const unsubscribe = subscribeAiActivities(update);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, []);

  return (
    <aside className="hidden md:flex w-[220px] xl:w-[280px] shrink-0 h-full flex-col border-l border-[#b4945d]/40 bg-[#211e1b] p-3 text-sm text-[#eee2c9]" aria-label="Zerone Agent 运行日志">
        <div className="min-h-0 overflow-y-auto">
          <strong>Zerone Agent 正在玩</strong>
          <p className="mb-3 text-xs text-[#b8aa91]">仅显示请求状态和耗时，不显示密钥、身份牌或提示词。</p>
          {items.length === 0 ? <p className="text-[#b8aa91]">本页还没有 AI 请求。</p> : (
            <ol className="space-y-2">
              {items.slice(0, 20).map((item) => (
                <li key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.label} · Zerone Agent · {phaseLabels[item.phase] || item.phase}</span>
                    <span className={item.status === "error" ? "text-red-300" : item.status === "running" ? "text-amber-300" : "text-green-300"}>
                      {item.status === "running" ? "思考中" : item.status === "error" ? "失败" : "完成"}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-[#b8aa91]">
                    <span>{new Date(item.startedAt).toLocaleTimeString("zh-CN", { hour12: false })}</span>
                    <span>{duration(item, now)}{item.retryCount ? ` · 重试 ${item.retryCount} 次` : ""}{item.detail ? ` · ${item.detail}` : ""}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
    </aside>
  );
}
