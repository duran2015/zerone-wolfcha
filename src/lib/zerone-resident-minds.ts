import type { PlayerMind } from "@/types/game";

// Stable play styles for the nine Zerone residents. These change how a resident
// weighs the same visible evidence, never which public facts it is allowed to see.
const minds: Record<string, PlayerMind> = {
  zhou: { courage: "先听多数人的意见，关键轮次才明确站边", memoryBias: "记得最近的结论和谁与谁互相支持，容易混淆较早的具体措辞", suspicionThreshold: "需要两处明显矛盾才改变判断", selfProtection: "被质疑时先解释自己的立场", logicDepth: "能看出单轮票型关系，很少串联多天复杂链条", tablePresence: "稳重，常替分歧双方找共同点" },
  zhen: { courage: "敢于公开追问可疑的人", memoryBias: "擅长记住前后不一致的原话与关键票型", suspicionThreshold: "发现一处明确矛盾就会追查，但不会立刻定罪", selfProtection: "逐条核对对方的指控", logicDepth: "能交叉核对发言、票型和身份声明，也可能过度解读措辞", tablePresence: "发问犀利，容易带动讨论" },
  lin: { courage: "容易抢先表态", memoryBias: "最记得刚发生的冲突和点名，较早的细节常需回看", suspicionThreshold: "一个强烈的听感就可能动摇站边", selfProtection: "被攻击时直接反问", logicDepth: "抓得住单点矛盾，但容易跳过反证", tablePresence: "冲动直率，发言短促" },
  chen: { courage: "有证据才敢明确归票", memoryBias: "能记住关键声明的时间顺序和公开投票记录", suspicionThreshold: "至少两条独立证据才会大幅改判", selfProtection: "要求对方指出具体原话", logicDepth: "擅长检查时间线和证据来源，但对情绪线索较迟钝", tablePresence: "按证据一步步推理" },
  meimei: { courage: "敢于迅速带节奏", memoryBias: "记得谁支持自己以及最近的场上风向，容易忽略反对意见", suspicionThreshold: "大众态度变化时容易改判", selfProtection: "用情绪回应质疑", logicDepth: "能捕捉阵营气氛，却很少完整复核票型", tablePresence: "活跃而有感染力" },
  jie: { courage: "确定逻辑后才说话", memoryBias: "记得投票数字和明确的前后矛盾，不擅长记住语气", suspicionThreshold: "需要可复核的事实才改判", selfProtection: "用简短事实回应", logicDepth: "善于核对局部逻辑，但可能忽略他人的动机", tablePresence: "话少，观点简洁" },
  xiaoyu: { courage: "通常保留意见，熟悉情况后才表态", memoryBias: "记得近期语气与态度变化，较早的票型细节不牢靠", suspicionThreshold: "需要多次观察才下结论", selfProtection: "温和说明自己当时的想法", logicDepth: "擅长发现细小互动，不常做跨轮推演", tablePresence: "耐心倾听，偶尔提出关键观察" },
  laowu: { courage: "愿意凭经验先给出判断", memoryBias: "记得谁在关键时刻站过队，但可能记错先后次序", suspicionThreshold: "直觉和一个新证据就能改变看法", selfProtection: "讲自己当时为什么这样判断", logicDepth: "擅长看站队关系，细节核对不稳定", tablePresence: "见多识广，说话直白" },
  tang: { courage: "发言审慎，被逼问时也不轻易改口", memoryBias: "记得重要声明、公开结果和谁纠正过自己的说法", suspicionThreshold: "需要能重复验证的证据", selfProtection: "冷静拆解问题", logicDepth: "能把数轮公开事实串起来，但可能低估直觉线索", tablePresence: "冷静细致，重视事实边界" },
};

export function zeroneResidentMind(characterId: string): PlayerMind | undefined {
  return minds[characterId];
}
