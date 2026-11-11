"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAtom, useStore } from "jotai";
import type { GameState, Player } from "@/types/game";
import { prefetchCriteriaKey, type PrefetchCriteria, type PrefetchedSpeech } from "../useDialogueManager";
import { gameStateAtom } from "@/store/game-machine";
import {
  transitionPhase,
  addSystemMessage,
  addPlayerMessage,
  killPlayer,
  generateAISpeechSegmentsStream,
  getSpeechContextKey,
} from "@/lib/game-master";
import { getNextSpeechSeat } from "@/lib/speech-order";
import { PHASE_CATEGORIES } from "@/lib/game-constants";
import { type FlowToken } from "@/lib/game-flow-controller";
import { audioManager, makeAudioTaskId, type TtsProvider } from "@/lib/audio-manager";
import { getModelSource } from "@/lib/api-keys";
import { resolveVoiceId, type AppLocale } from "@/lib/voice-constants";
import { getLocale } from "@/i18n/locale-store";
import { createSpeechRequest, type SpeechRequest } from "@/lib/speech-request";
import { generateUUID } from "@/lib/utils";
import { isGameSessionExpiredMessage } from "@/lib/llm";
import { recordDemoFixMetric } from "@/lib/demo-fix-metrics";

export interface DayPhaseCallbacks {
  setDialogue: (speaker: string, text: string, isStreaming?: boolean) => void;
  setIsWaitingForAI: (waiting: boolean) => void;
  setWaitingForNextRound: (waiting: boolean) => void;
  isTokenValid: (token: FlowToken) => boolean;
  getToken: () => FlowToken;
  initSpeechQueue: (segments: string[], player: Player, afterSpeech?: (s: unknown) => Promise<void>, request?: SpeechRequest) => void;
  initStreamingSpeechQueue: (player: Player, afterSpeech?: (s: unknown) => Promise<void>, request?: SpeechRequest) => void;
  appendToSpeechQueue: (segment: string, requestId?: string, index?: number) => void;
  finalizeSpeechQueue: (options?: { nextSpeakerIsAI?: boolean; requestId?: string }) => void;
  setPrefetchedSpeech: (prefetch: PrefetchedSpeech | null) => void;
  consumePrefetchedSpeech: (criteria: PrefetchCriteria) => string[] | null;
  setAfterLastWords: (callback: ((s: GameState) => Promise<void>) | null) => void;
}

type PendingSpeechPrefetch = {
  criteria: PrefetchCriteria;
  controller: AbortController;
  promise: Promise<string[]>;
  segments: string[];
  listeners: Set<(segment: string, index: number) => void>;
};

const samePrefetchScope = (left: PrefetchCriteria, right: Pick<PrefetchCriteria, "gameId" | "day" | "phase">) =>
  left.gameId === right.gameId && left.day === right.day && left.phase === right.phase;

const speechActivityId = (state: GameState, player: Player): string =>
  `speech:${state.gameId}:${state.day}:${state.phase}:${player.playerId}:${state.speechRoundStartMessageIndex ?? 0}`;

export interface DayPhaseActions {
  isSpeechBlocked: () => boolean;
  startLastWordsPhase: (state: GameState, seat: number, afterLastWords: (s: GameState) => Promise<void>, token: FlowToken) => Promise<void>;
  runAISpeech: (state: GameState, player: Player, options?: { afterSpeech?: (s: GameState) => Promise<void> }) => Promise<void>;
}

/**
 * 白天阶段 Hook
 * 负责管理白天流程：发言、遗言等
 */
export function useDayPhase(
  humanPlayer: Player | null,
  callbacks: DayPhaseCallbacks
): DayPhaseActions {
  const t = useTranslations();
  const speakerHost = t("speakers.host");
  const [gameState, setGameState] = useAtom(gameStateAtom);

  const {
    setDialogue,
    setIsWaitingForAI,
    setWaitingForNextRound,
    isTokenValid,
    getToken,
    initStreamingSpeechQueue,
    appendToSpeechQueue,
    finalizeSpeechQueue,
    setPrefetchedSpeech,
    consumePrefetchedSpeech,
    setAfterLastWords,
  } = callbacks;

  const store = useStore();
  const activeRequestRef = useRef<(SpeechRequest & { controller: AbortController }) | null>(null);
  const pendingPrefetchesRef = useRef(new Map<string, PendingSpeechPrefetch>());
  const failedRequestRef = useRef<SpeechRequest | null>(null);
  const isSpeechBlocked = useCallback(() => failedRequestRef.current?.isValid() === true, []);

  useEffect(() => {
    if (activeRequestRef.current && !activeRequestRef.current.isValid()) {
      activeRequestRef.current.controller.abort();
    }
    for (const [key, pending] of pendingPrefetchesRef.current) {
      if (samePrefetchScope(pending.criteria, gameState)) continue;
      pending.controller.abort();
      pendingPrefetchesRef.current.delete(key);
    }
  }, [gameState]);
  useEffect(() => () => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    for (const pending of pendingPrefetchesRef.current.values()) pending.controller.abort();
    pendingPrefetchesRef.current.clear();
  }, []);

  const prefetchNextAISpeech = useCallback(async (state: GameState, player: Player) => {
    if (!player.agentProfile) return;
    const base: PrefetchedSpeech = {
      gameId: state.gameId, contextKey: getSpeechContextKey(state, player),
      playerId: player.playerId, phase: state.phase, day: state.day,
      segments: [], isComplete: false, createdAt: Date.now(),
    };
    const criteria: PrefetchCriteria = {
      gameId: base.gameId, contextKey: base.contextKey, playerId: base.playerId,
      phase: base.phase, day: base.day,
    };
    const key = prefetchCriteriaKey(criteria);
    const existing = pendingPrefetchesRef.current.get(key);
    if (existing && !existing.controller.signal.aborted) return existing.promise.then(() => undefined);

    for (const [pendingKey, pending] of pendingPrefetchesRef.current) {
      if (samePrefetchScope(pending.criteria, criteria)) continue;
      pending.controller.abort();
      pendingPrefetchesRef.current.delete(pendingKey);
    }

    const controller = new AbortController();
    const token = getToken();
    const isValid = () => !controller.signal.aborted && token.isValid() &&
      pendingPrefetchesRef.current.get(key)?.controller === controller && store.get(gameStateAtom).gameId === state.gameId;
    const pending = { criteria, controller, promise: Promise.resolve([] as string[]), segments: [] as string[], listeners: new Set<(segment: string, index: number) => void>() };
    pendingPrefetchesRef.current.set(key, pending);
    const promise = generateAISpeechSegmentsStream(state, player, { signal: controller.signal,
      activityId: speechActivityId(state, player),
      onSegmentReceived: (segment, index) => {
        pending.segments[index] = segment;
        for (const listener of pending.listeners) listener(segment, index);
      },
    });
    pending.promise = promise;
    try {
      const segments = await promise;
      if (isValid()) setPrefetchedSpeech({ ...base, segments, isComplete: true });
    } catch { /* aborted or failed prefetches are not cached */ }
    finally {
      if (pendingPrefetchesRef.current.get(key)?.controller === controller) pendingPrefetchesRef.current.delete(key);
    }
  }, [getToken, setPrefetchedSpeech, store]);

  /** 每次请求持有独立段落和令牌；所有异步回调在写入前验证来源。 */
  const runAISpeech = useCallback(async (
    state: GameState,
    player: Player,
    options?: { afterSpeech?: (s: GameState) => Promise<void> }
  ) => {
    if (!PHASE_CATEGORIES.SPEECH_PHASES.includes(state.phase as typeof PHASE_CATEGORIES.SPEECH_PHASES[number])) return;
    if (activeRequestRef.current?.isValid()) return;
    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const id = generateUUID();
    const request = createSpeechRequest(id, state, player, getToken(), () => store.get(gameStateAtom),
      () => activeRequestRef.current?.id === id);
    activeRequestRef.current = { ...request, controller };
    failedRequestRef.current = null;
    if (!request.isValid()) return;
    const isValid = () => request.isValid() && !controller.signal.aborted;
    const afterSpeech = options?.afterSpeech as ((s: unknown) => Promise<void>) | undefined;
    const modelSource = getModelSource();
    const persona = player.agentProfile?.persona;
    const voiceId = resolveVoiceId(
      persona?.voiceId,
      persona?.gender,
      persona?.age,
      getLocale() as AppLocale,
    );
    const ttsProvider: TtsProvider = process.env.NEXT_PUBLIC_ALIYUN_VOICE_ENABLED === "1"
      ? "aliyun" : modelSource === "tokenpay"
      || player.agentProfile?.modelRef?.provider === "tokendance"
      ? "tokendance"
      : "minimax";
    const collected: string[] = [];
    let displayChain = Promise.resolve();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const thinkingTimer = setInterval(() => {
      if (isValid() && collected.length === 0) setDialogue(`${player.seat + 1}号 · ${player.displayName} · Zerone Agent`, `仍在思考（已用 ${Math.floor((Date.now() - startedAt) / 1000)} 秒）`, true);
    }, 1000);

    const appendSegment = (segment: string, index: number) => {
      if (!isValid() || index !== collected.length) return;
      collected.push(segment);
      const task = {
        id: makeAudioTaskId(voiceId, segment, ttsProvider),
        playbackId: `${id}:${index}`,
        isValid,
        text: segment,
        voiceId,
        playerId: player.playerId,
        ttsProvider,
      };
      // 字幕先显示；语音只预加载，用户按 Enter 后才播放。
      displayChain = displayChain.then(async () => {
        if (!isValid()) return;
        if (index === 0) {
          setIsWaitingForAI(false);
        }
        appendToSpeechQueue(segment, id, index);
        if (audioManager.isEnabled()) {
          void audioManager.ensureReady(task).catch(() => undefined);
        }
      });
    };

    const criteria: PrefetchCriteria = {
      gameId: state.gameId, contextKey: getSpeechContextKey(state, player),
      playerId: player.playerId, phase: state.phase, day: state.day,
    };
    const prefetched = consumePrefetchedSpeech(criteria);
    const matchingPending = pendingPrefetchesRef.current.get(prefetchCriteriaKey(criteria)) ?? null;
    if (prefetched || matchingPending) recordDemoFixMetric(state.gameId, "prefetchHits");
    initStreamingSpeechQueue(player, afterSpeech, request);
    setIsWaitingForAI(true);
    setDialogue(player.displayName, t("dayPhase.organizing"), true);

    try {
      const firstAttempt = new AbortController();
      const firstStream = prefetched
        ? Promise.resolve(prefetched.forEach(appendSegment))
        : matchingPending
          ? (async () => {
              matchingPending.listeners.add(appendSegment);
              matchingPending.segments.forEach(appendSegment);
              try { await matchingPending.promise; }
              finally { matchingPending.listeners.delete(appendSegment); }
            })()
        : generateAISpeechSegmentsStream(state, player, {
            signal: AbortSignal.any([controller.signal, firstAttempt.signal]),
            activityId: speechActivityId(state, player),
            onSegmentReceived: appendSegment,
          });
      // Always observe a losing promise: cancellation may reject after the timer wins.
      void firstStream.catch(() => undefined);
      const firstResult = await Promise.race([firstStream.then(() => "done" as const), new Promise<"timeout">((resolve) => {
        timeoutId = setTimeout(() => resolve("timeout"), 60_000);
      })]);
      clearTimeout(timeoutId);
      if (firstResult === "timeout") {
        if (!isValid()) return;
        if (collected.length === 0) {
          recordDemoFixMetric(state.gameId, "retries");
          firstAttempt.abort();
          matchingPending?.controller.abort();
          const retryController = new AbortController();
          const retry = generateAISpeechSegmentsStream(state, player, {
            signal: AbortSignal.any([controller.signal, retryController.signal]),
            activityId: speechActivityId(state, player),
            onSegmentReceived: appendSegment,
          });
          void retry.catch(() => undefined);
          await Promise.race([retry, new Promise<never>((_, reject) => { timeoutId = setTimeout(() => { retryController.abort(); reject(new Error("Zerone Agent 发言超过 120 秒")); }, 60_000); })]);
        } else {
          await Promise.race([firstStream, new Promise<never>((_, reject) => { timeoutId = setTimeout(() => {
            firstAttempt.abort();
            matchingPending?.controller.abort();
            reject(new Error("Zerone Agent 发言超过 120 秒"));
          }, 60_000); })]);
        }
      }
      if (!isValid()) return;
      await displayChain;
      if (!isValid()) return;
      const nextSeat = getNextSpeechSeat(state);
      const nextPlayer = state.players.find((p) => p.seat === nextSeat);
      const nextSpeakerIsAI = !!nextPlayer && !nextPlayer.isHuman && nextPlayer.alive;
      finalizeSpeechQueue({ nextSpeakerIsAI, requestId: id });
      // 按相同段落 ID 构造预计状态，已提交的段落不会重复进入预取上下文。
      if (nextSpeakerIsAI && nextPlayer) {
        const postState = collected.reduce((next, segment, index) =>
          addPlayerMessage(next, player.playerId, segment, { id: `${id}:${index}` }), store.get(gameStateAtom));
        void prefetchNextAISpeech({ ...postState, currentSpeakerSeat: nextPlayer.seat }, nextPlayer);
      }
    } catch (error) {
      if (!isValid()) return;
      controller.abort();
      await displayChain;
      // 错误属于系统，不能记为角色台词。保留已确认段落，阻止自动推进至下一人。
      failedRequestRef.current = request;
      recordDemoFixMetric(state.gameId, "failures");
      if (!collected.length) setDialogue(speakerHost, t(isGameSessionExpiredMessage(String(error))
        ? "dayPhase.sessionExpired" : "dayPhase.interrupted"), false);
      finalizeSpeechQueue({ requestId: id });
      toast.error(getLocale() === "zh" ? "发言生成失败，游戏已暂停推进" : "Speech failed. Progress is paused.", {
        duration: Infinity,
        action: { label: getLocale() === "zh" ? "重试发言" : "Retry speech", onClick: () => {
          if (!request.isValid()) return;
          activeRequestRef.current = null;
          void runAISpeech(store.get(gameStateAtom), player, options);
        } },
      });
    } finally {
      clearTimeout(timeoutId);
      clearInterval(thinkingTimer);
      if (request.isValid()) setIsWaitingForAI(false);
    }
  }, [appendToSpeechQueue, consumePrefetchedSpeech, finalizeSpeechQueue, getToken,
    initStreamingSpeechQueue, prefetchNextAISpeech, setDialogue, setIsWaitingForAI, speakerHost, store, t]);

  // 更新 ref 以打破循环依赖
  /** 开始遗言阶段 */
  const startLastWordsPhase = useCallback(async (
    state: GameState,
    seat: number,
    afterLastWords: (s: GameState) => Promise<void>,
    token: FlowToken
  ) => {
    if (!isTokenValid(token)) return;
    const speaker = state.players.find((p) => p.seat === seat);
    if (!speaker) {
      await afterLastWords(state);
      return;
    }

    setWaitingForNextRound(false);

    // 确保遗言发言者已标记为死亡
    let currentState = speaker.alive ? killPlayer(state, seat) : state;
    currentState = transitionPhase(currentState, "DAY_LAST_WORDS");
    currentState = { ...currentState, currentSpeakerSeat: seat };
    currentState = addSystemMessage(currentState, t("dayPhase.lastWordsSystem", { seat: seat + 1, name: speaker.displayName }));
    setGameState(currentState);

    if (speaker.isHuman) {
      // 保存回调，等待人类发言完毕后调用
      setAfterLastWords(afterLastWords);
      setDialogue(speakerHost, t("dayPhase.lastWordsPrompt", { seat: seat + 1, name: speaker.displayName }), false);
      return;
    }

    if (!isTokenValid(token)) return;

    await runAISpeech(currentState, speaker, {
      afterSpeech: async (s) => {
        if (!isTokenValid(token)) return;
        await afterLastWords(s as GameState);
      },
    });
  }, [setGameState, setDialogue, setWaitingForNextRound, isTokenValid, runAISpeech, setAfterLastWords, speakerHost, t]);

  return {
    isSpeechBlocked,
    startLastWordsPhase,
    runAISpeech,
  };
}
