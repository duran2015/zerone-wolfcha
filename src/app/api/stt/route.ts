import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { callAliyunVoice, isAliyunVoiceConfigured } from "@/lib/aliyun-voice-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request as unknown as Request);
  if ("error" in auth) return auth.error;
  if (!isAliyunVoiceConfigured()) return NextResponse.json({ error: "阿里云语音尚未配置" }, { status: 503 });
  const input: unknown = await request.json().catch(() => null);
  const audio = input && typeof input === "object" ? (input as { audio?: unknown }).audio : null;
  if (typeof audio !== "string" || !/^[A-Za-z0-9+/=]+$/.test(audio) || audio.length > 12_000_000) {
    return NextResponse.json({ error: "无效或过长的录音" }, { status: 400 });
  }
  try {
    const response = await callAliyunVoice("/api/v1/services/aigc/multimodal-generation/generation", {
      model: process.env.ALIYUN_ASR_MODEL || "qwen-audio-3.1-asr-flash",
      input: { messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: `data:audio/wav;base64,${audio}` } }] }] },
      parameters: { format: "wav" },
    });
    if (!response.ok) {
      const failure: unknown = await response.json().catch(() => null);
      const code = failure && typeof failure === "object" ? (failure as { code?: unknown; message?: unknown }).code : null;
      const detail = failure && typeof failure === "object" ? (failure as { message?: unknown }).message : null;
      if (["ASR_RESPONSE_HAVE_NO_WORDS", "NO_INPUT_AUDIO_ERROR", "SUCCESS_WITH_NO_VALID_FRAGMENT"].includes(String(code))
        || detail === "ASR_RESPONSE_HAVE_NO_WORDS") {
        return NextResponse.json({ error: "没识别到人声，请靠近麦克风说一句完整的话后再结束录音" }, { status: 422 });
      }
      console.warn("[aliyun-voice] ASR rejected request", { status: response.status, code: typeof code === "string" ? code : undefined });
      return NextResponse.json({ error: "语音识别失败，请检查麦克风后重试" }, { status: 502 });
    }
    const result: unknown = await response.json();
    const text = result && typeof result === "object" && "output" in result
      ? (result as { output?: { text?: unknown } }).output?.text : null;
    if (typeof text !== "string") return NextResponse.json({ error: "语音识别结果无文字" }, { status: 502 });
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[aliyun-voice] ASR failed", error);
    return NextResponse.json({ error: "语音识别请求失败" }, { status: 502 });
  }
}
