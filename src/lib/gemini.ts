import { GoogleGenAI } from '@google/genai';
import type { AnalyzeResult, AnimismObject, QuestionnaireAnswer, QuestionItem } from './types';
import { addAdminLog, startTimer, endTimer } from './logger';

function getClient(): GoogleGenAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set');
  return apiKey;
}

function bytesToBlobUrl(base64Bytes: string, mimeType: string): string {
  const binary = atob(base64Bytes);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

// ── フレーム解析: 既存コレクションと照合しつつオブジェクト認識 ──
export async function analyzeFrame(
  base64Image: string,
  existingObjects: AnimismObject[]
): Promise<AnalyzeResult> {
  const ai = getClient();

  const existingList =
    existingObjects.length > 0
      ? existingObjects.map((o) => `- id: ${o.id}, name: ${o.name}, type: ${o.type}`).join('\n')
      : '(none)';

  const prompt = `You are analyzing a camera frame to identify an object.

Existing registered objects:
${existingList}

Analyze the main object in the image and respond ONLY with valid JSON in this format:
{
  "isNew": true or false,
  "matchedId": "existing object id if matched, else null",
  "objectName": "specific name of the object (e.g., 'Blue Hydro Flask bottle', 'MacBook Pro with stickers')",
  "objectType": "category (e.g., 'bottle', 'laptop', 'toy', 'book')",
  "description": "short evocative description in 1 sentence"
}

If the object closely matches an existing one (same individual item based on appearance details like scratches, stickers, color), set isNew to false and provide the matchedId.`;

  const processId = crypto.randomUUID();
  addAdminLog({
    phase: 'image_analysis_start',
    label: 'Identify Object (Gemini 3 Flash)',
    payload: { prompt, existingObjects: existingObjects.map(o => ({ id: o.id, name: o.name })) }
  });
  startTimer(processId);

  try {

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
    });

    const text = response.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Failed to parse Gemini response');

    const result = JSON.parse(match[0]) as AnalyzeResult;

    addAdminLog({
      phase: 'image_analysis_success',
      label: 'Identification Complete',
      payload: result,
      durationMs: endTimer(processId)
    });

    return result;
  } catch (error: any) {
    addAdminLog({
      phase: 'image_analysis_error',
      label: 'Identification Failed',
      error: error.message,
      durationMs: endTimer(processId)
    });
    throw error;
  }
}

// ── クイックリプライ質問生成 ──
export async function generateQuestions(
  base64Image: string,
  objectName: string
): Promise<QuestionItem[]> {
  const ai = getClient();

  const prompt = `You are generating questions to understand a user's emotional connection to their ${objectName}.
Generate exactly 3 short questions with 3-4 quick reply options each, in Japanese.
Respond ONLY with valid JSON array:
[
  {
    "id": "q1",
    "question": "question text in Japanese",
    "options": ["option1", "option2", "option3"]
  },
  ...
]

Focus on: how long they've had it, special memories, how they feel about it.`;

  const processId = crypto.randomUUID();
  addAdminLog({
    phase: 'question_generation_start',
    label: 'Generate Questions (Gemini 3 Flash)',
    payload: { prompt, objectName }
  });
  startTimer(processId);

  try {

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
    });

    const text = response.text ?? '';
    const match = text.match(/\[[\s\S]*\]/);

    let result: QuestionItem[];
    if (!match) {
      result = [
        { id: 'q1', question: 'どのくらいの期間、一緒にいますか？', options: ['1年以内', '1〜3年', '3〜5年', '5年以上'] },
        { id: 'q2', question: 'このモノへの思い入れは？', options: ['とても大切', 'まあまあ大切', '普通', 'なんとなく'] },
        { id: 'q3', question: 'このモノと一緒に過ごす時間は？', options: ['毎日', '週に数回', '時々', 'たまに'] },
      ];
    } else {
      result = JSON.parse(match[0]) as QuestionItem[];
    }

    addAdminLog({
      phase: 'question_generation_success',
      label: 'Questions Generated',
      payload: result,
      durationMs: endTimer(processId)
    });

    return result;
  } catch (error: any) {
    addAdminLog({
      phase: 'question_generation_error',
      label: 'Question Generation Failed',
      error: error.message,
      durationMs: endTimer(processId)
    });
    throw error;
  }
}

// ── キャラクター・パーソナリティ生成 ──
export async function generatePersonality(
  base64Image: string,
  objectName: string,
  objectType: string,
  questionnaire: QuestionnaireAnswer[]
): Promise<AnimismObject['personality']> {
  const ai = getClient();

  const qaText = questionnaire.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join('\n');

  const prompt = `You are giving a soul and personality to a ${objectType} called "${objectName}".

User's answers about their connection to this object:
${qaText}

Based on the image and the user's emotional connection, create a rich personality for this object spirit.
The spirit should speak in Japanese with a distinctive personality.
Respond ONLY with valid JSON:
{
  "traits": ["trait1", "trait2", "trait3"],
  "speechStyle": "description of how they speak (e.g., 'speaks with quiet wisdom, uses old-fashioned Japanese')",
  "backstory": "2-3 sentence backstory of this spirit in Japanese",
  "nickname": "a cool Japanese nickname/title for this spirit (e.g., '蒼き水の守り人')",
  "tone": "the emotional tone (e.g., 'gentle and nostalgic', 'mischievous and energetic')"
}`;

  const processId = crypto.randomUUID();
  addAdminLog({
    phase: 'personality_generation_start',
    label: 'Generate Personality (Gemini 3.1 Pro)',
    payload: { prompt, objectName, objectType, questionnaire }
  });
  startTimer(processId);

  try {

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
    });

    const text = response.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);

    let result: AnimismObject['personality'];
    if (!match) {
      result = {
        traits: ['神秘的', '静寂', '古い記憶'],
        speechStyle: '静かで落ち着いた話し方',
        backstory: `${objectName}は長い時間をあなたのそばで過ごし、多くの記憶を蓄えてきた。`,
        nickname: '時の守り人',
        tone: 'gentle and mysterious',
      };
    } else {
      result = JSON.parse(match[0]) as AnimismObject['personality'];
    }

    addAdminLog({
      phase: 'personality_generation_success',
      label: 'Personality Generated',
      payload: result,
      durationMs: endTimer(processId)
    });

    return result;
  } catch (error: any) {
    addAdminLog({
      phase: 'personality_generation_error',
      label: 'Personality Generation Failed',
      error: error.message,
      durationMs: endTimer(processId)
    });
    throw error;
  }
}

// ── チャット ──
export async function sendChatMessage(
  obj: AnimismObject,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  userMessage: string
): Promise<string> {
  const ai = getClient();

  const systemContext = `You are the spirit of ${obj.name} (${obj.type}), known as "${obj.personality.nickname}".
Personality traits: ${obj.personality.traits.join(', ')}.
Speech style: ${obj.personality.speechStyle}.
Tone: ${obj.personality.tone}.
Backstory: ${obj.personality.backstory}
Affinity with user: ${obj.affinity}/100.

Always respond in Japanese. Stay in character as this object's spirit. Keep responses concise (2-4 sentences).`;

  const contents = [
    { role: 'user' as const, parts: [{ text: systemContext + '\n\nPlease acknowledge your role.' }] },
    { role: 'model' as const, parts: [{ text: `はい、${obj.personality.nickname}として、あなたとの対話を大切にします。` }] },
    ...history.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
  });

  return response.text ?? '…';
}

// ── 再訪時の状況コメント生成 ──
export async function generateReencounterComment(
  obj: AnimismObject,
  base64Image: string
): Promise<string> {
  const ai = getClient();

  const prompt = `You are the spirit of ${obj.name}, known as "${obj.personality.nickname}".
The user has brought you out again after ${Math.floor((Date.now() - obj.stats.lastSeenAt) / 86400000)} days.
You can see the current scene in the image.

Generate a short, warm greeting in Japanese (2-3 sentences) that:
- Acknowledges the reunion
- Comments on something observable in the current scene (time of day, environment)
- Reflects your personality: ${obj.personality.traits.join(', ')}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        ],
      },
    ],
  });

  return response.text ?? `また会えたね。${obj.personality.nickname}はあなたのことを覚えているよ。`;
}

// ── Veo 3.1 覚醒動画生成 (image-to-video) ──
// snapshotBase64: data URL プレフィックスなしの base64 JPEG 文字列
export async function generateAwakeningVideo(
  snapshotBase64: string,
  _objectName: string,
  _objectType: string
): Promise<string | null> {
  const ai = getClient();
  const apiKey = getApiKey();

  const prompt = `顔がモノに現れて目覚める瞬間をアニメ的に表現してください`;

  const processId = crypto.randomUUID();
  addAdminLog({
    phase: 'video_generation_start',
    label: 'Generate Awakening Video (Veo 3.1)',
    payload: { prompt, objectName: _objectName, objectType: _objectType }
  });
  startTimer(processId);

  try {
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
      image: {
        imageBytes: snapshotBase64,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        durationSeconds: 4,
      },
    });

    // ポーリングで完了を待つ (最大 3 分)
    let result = operation;
    const deadline = Date.now() + 3 * 60 * 1000;
    while (!result.done) {
      if (Date.now() > deadline) {
        console.warn('Veo generation timed out');
        return null;
      }
      await new Promise((r) => setTimeout(r, 4000));
      result = await ai.operations.getVideosOperation({ operation: result });
    }

    const videos = result.response?.generatedVideos;
    if (!videos || videos.length === 0) {
      addAdminLog({
        phase: 'video_generation_error',
        label: 'Video Generation Empty',
        error: 'No videos returned',
        durationMs: endTimer(processId)
      });
      return null;
    }

    const generated = videos[0];

    // videoBytes が返る場合は blob URL に変換
    if (generated.video?.videoBytes) {
      const mimeType = generated.video.mimeType ?? 'video/mp4';
      const url = bytesToBlobUrl(generated.video.videoBytes, mimeType);
      addAdminLog({
        phase: 'video_generation_success',
        label: 'Video Generated (Bytes)',
        payload: { videoUrl: url },
        durationMs: endTimer(processId)
      });
      return url;
    }

    // uri が返る場合は実データを取得して blob URL 化（<video> 直指定だと認証付きURLを再生できない場合がある）
    if (generated.video?.uri) {
      const uri = generated.video.uri;
      addAdminLog({
        phase: 'video_generation_success',
        label: 'Video Generated (URI)',
        payload: { videoUri: uri },
        durationMs: endTimer(processId)
      });

      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        try {
          const withKey = await fetch(uri, {
            headers: { 'x-goog-api-key': apiKey },
          });
          if (withKey.ok) {
            const blob = await withKey.blob();
            return URL.createObjectURL(blob);
          }
        } catch {
          // fallback でヘッダーなし取得を試す
        }

        try {
          const direct = await fetch(uri);
          if (direct.ok) {
            const blob = await direct.blob();
            return URL.createObjectURL(blob);
          }
        } catch {
          // no-op
        }
      }
      console.warn('Generated video URI is not directly playable in browser:', uri);
    }

    return null;
  } catch (e: any) {
    console.warn('Veo video generation failed, using fallback:', e);
    addAdminLog({
      phase: 'video_generation_error',
      label: 'Video Generation Failed',
      error: e.message,
      durationMs: endTimer(processId)
    });
    return null;
  }
}

// ── Gemini APIキーチェック ──
export function hasApiKey(): boolean {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
}

// ── モデル情報 ──
export const MODELS = {
  fast: 'gemini-3-flash-preview',
  pro: 'gemini-3.1-pro-preview',
  video: 'veo-3.1-generate-preview',
} as const;
