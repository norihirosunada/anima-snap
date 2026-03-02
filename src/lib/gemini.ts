import { GoogleGenAI } from '@google/genai';
import type { AnalyzeResult, AnimismObject, QuestionnaireAnswer, QuestionItem, Memory, AlbumPhoto } from './types';
import { addAdminLog, startTimer, endTimer } from './logger';

export const MODELS = {
  fast: 'gemini-3-flash-preview',
  pro: 'gemini-3.1-pro-preview',
  video: 'veo-3.1-generate-preview',
} as const;

const RETRYABLE_ERROR_KEYWORDS = ['503', 'UNAVAILABLE', 'SERVICE UNAVAILABLE'];
const MIN_QUICK_REPLY_OPTIONS = 3;
const MAX_QUICK_REPLY_OPTIONS = 4;
const GENERIC_OPTIONS = ['とても当てはまる', '少し当てはまる', 'どちらとも言えない', 'あまり当てはまらない'];

const DEFAULT_QUESTION_SET: QuestionItem[] = [
  {
    id: 'q1',
    question: 'どのくらいの期間、一緒にいますか？',
    options: ['1年以上', '1〜3年', '3〜5年', '5年以上'],
  },
  {
    id: 'q2',
    question: 'このモノへの思い入れは？',
    options: ['とても大切', 'まあまあ大切', '普通', 'なんとなく'],
  },
  {
    id: 'q3',
    question: 'このモノと一緒に過ごす時間は？',
    options: ['毎日', '週に数回', '時々', 'たまに'],
  },
];

function readApiKeyFromEnv(): string {
  const viteApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const legacyApiKey = (import.meta.env as Record<string, string | undefined>).GEMINI_API_KEY;
  return (viteApiKey ?? legacyApiKey ?? '').trim();
}

function getClient(): GoogleGenAI {
  const apiKey = readApiKeyFromEnv();
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY or GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

function getApiKey(): string {
  const apiKey = readApiKeyFromEnv();
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY or GEMINI_API_KEY is not set');
  return apiKey;
}

async function saveVideoToServer(base64Data: string, mimeType: string): Promise<string> {
  const response = await fetch('/api/save-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data, mimeType }),
  });
  if (!response.ok) throw new Error(`Failed to save video: ${response.status}`);
  const json = await response.json() as { url: string };
  return json.url;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  const mimeType = blob.type && blob.type.length > 0 ? blob.type : 'video/mp4';
  return `data:${mimeType};base64,${base64}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableError(error: unknown): boolean {
  const upperMessage = toErrorMessage(error).toUpperCase();

  if (RETRYABLE_ERROR_KEYWORDS.some((keyword) => upperMessage.includes(keyword))) {
    return true;
  }

  if (typeof error !== 'object' || error === null) return false;
  const maybeError = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  return maybeError.status === 503 || maybeError.statusCode === 503 || maybeError.code === 503;
}

async function callWithRetry<T>(func: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await func();
    } catch (error) {
      const canRetry = attempt < maxRetries - 1 && isRetryableError(error);
      if (!canRetry) throw error;

      const waitSeconds = 2 ** attempt + Math.random();
      console.warn(`503エラー、${waitSeconds.toFixed(1)}秒後にリトライ (${attempt + 1}/${maxRetries})`);
      await sleep(waitSeconds * 1000);
    }
  }
  throw new Error('最大リトライ回数に達しました');
}

function cloneDefaultQuestions(): QuestionItem[] {
  return DEFAULT_QUESTION_SET.map((q) => ({ ...q, options: [...q.options] }));
}

function normalizeOptions(rawOptions: unknown, fallbackOptions: string[]): string[] {
  const primary = Array.isArray(rawOptions)
    ? rawOptions
        .filter((option): option is string => typeof option === 'string')
        .map((option) => option.trim())
        .filter((option) => option.length > 0)
    : [];

  const merged: string[] = [];
  for (const option of [...primary, ...fallbackOptions, ...GENERIC_OPTIONS]) {
    if (!option || merged.includes(option)) continue;
    merged.push(option);
    if (merged.length >= MAX_QUICK_REPLY_OPTIONS) break;
  }

  return merged.slice(0, MAX_QUICK_REPLY_OPTIONS);
}

function normalizeQuestionSet(rawQuestions: unknown): QuestionItem[] {
  if (!Array.isArray(rawQuestions)) return cloneDefaultQuestions();

  return DEFAULT_QUESTION_SET.map((fallback, index) => {
    const raw = rawQuestions[index];
    const item = typeof raw === 'object' && raw !== null
      ? (raw as { id?: unknown; question?: unknown; options?: unknown })
      : undefined;

    const id =
      typeof item?.id === 'string' && item.id.trim().length > 0
        ? item.id.trim()
        : fallback.id;

    const question =
      typeof item?.question === 'string' && item.question.trim().length > 0
        ? item.question.trim()
        : fallback.question;

    const options = normalizeOptions(item?.options, fallback.options);
    return { id, question, options };
  }).map((item, index) => {
    if (item.options.length >= MIN_QUICK_REPLY_OPTIONS) return item;
    return { ...item, options: [...DEFAULT_QUESTION_SET[index].options] };
  });
}

function extractFirstObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function extractFirstArray(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

export async function analyzeFrame(
  base64Image: string,
  existingObjects: AnimismObject[],
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
    payload: { prompt, existingObjects: existingObjects.map((o) => ({ id: o.id, name: o.name })) },
  });
  startTimer(processId);

  try {
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODELS.fast,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            ],
          },
        ],
      }),
    );

    const jsonText = extractFirstObject(response.text ?? '');
    if (!jsonText) throw new Error('Failed to parse Gemini response');

    const result = JSON.parse(jsonText) as AnalyzeResult;
    addAdminLog({
      phase: 'image_analysis_success',
      label: 'Identification Complete',
      payload: result,
      durationMs: endTimer(processId),
    });
    return result;
  } catch (error) {
    addAdminLog({
      phase: 'image_analysis_error',
      label: 'Identification Failed',
      error: toErrorMessage(error),
      durationMs: endTimer(processId),
    });
    throw error;
  }
}

export async function generateQuestions(
  base64Image: string,
  objectName: string,
): Promise<QuestionItem[]> {
  const ai = getClient();

  const prompt = `You are generating questions to understand a user's emotional connection to their ${objectName}.
Generate exactly 3 short questions with 3-4 quick reply options each, in Japanese.
Respond ONLY with valid JSON array:
[
  {
    "id": "q1",
    "question": "question text in Japanese",
    "options": ["option1", "option2", "option3", "option4"]
  },
  ...
]

Focus on: how long they've had it, special memories, how they feel about it.`;

  const processId = crypto.randomUUID();
  addAdminLog({
    phase: 'question_generation_start',
    label: 'Generate Questions (Gemini 3 Flash)',
    payload: { prompt, objectName },
  });
  startTimer(processId);

  try {
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODELS.fast,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            ],
          },
        ],
      }),
    );

    const jsonText = extractFirstArray(response.text ?? '');
    const result = jsonText ? normalizeQuestionSet(JSON.parse(jsonText)) : cloneDefaultQuestions();

    addAdminLog({
      phase: 'question_generation_success',
      label: 'Questions Generated',
      payload: result,
      durationMs: endTimer(processId),
    });
    return result;
  } catch (error) {
    addAdminLog({
      phase: 'question_generation_error',
      label: 'Question Generation Failed',
      error: toErrorMessage(error),
      durationMs: endTimer(processId),
    });
    throw error;
  }
}

export async function generatePersonality(
  base64Image: string,
  objectName: string,
  objectType: string,
  questionnaire: QuestionnaireAnswer[],
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
    payload: { prompt, objectName, objectType, questionnaire },
  });
  startTimer(processId);

  try {
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODELS.pro,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            ],
          },
        ],
      }),
    );

    const jsonText = extractFirstObject(response.text ?? '');
    const result = jsonText
      ? (JSON.parse(jsonText) as AnimismObject['personality'])
      : {
          traits: ['神秘的', '静寂', '古びた'],
          speechStyle: '静かで落ち着いた話し方',
          backstory: `${objectName}は長い時間をあなたのそばで過ごし、多くの記憶を蓄えてきた。`,
          nickname: '時の守り人',
          tone: 'gentle and mysterious',
        };

    addAdminLog({
      phase: 'personality_generation_success',
      label: 'Personality Generated',
      payload: result,
      durationMs: endTimer(processId),
    });
    return result;
  } catch (error) {
    addAdminLog({
      phase: 'personality_generation_error',
      label: 'Personality Generation Failed',
      error: toErrorMessage(error),
      durationMs: endTimer(processId),
    });
    throw error;
  }
}

// ── 記憶コンテキスト構築 ──
function buildMemoryContext(memories: Memory[], albumPhotos: AlbumPhoto[]): string {
  const parts: string[] = [];

  if (memories.length > 0) {
    const recent = memories.slice(-20); // 最新20件
    const lines = recent.map((m) => {
      const date = new Date(m.timestamp).toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      const typeLabel = m.type === 'awakening' ? '✦ 覚醒' : m.type === 're-encounter' ? '☽ 再会' : '✎ 会話';
      return `- [${date}] ${typeLabel}: ${m.content.slice(0, 100)}`;
    });
    parts.push(`過去の思い出・記憶:\n${lines.join('\n')}`);
  }

  const photosWithLocation = albumPhotos.filter((p) => p.location);
  if (photosWithLocation.length > 0) {
    const lines = photosWithLocation.map((p) => {
      const date = new Date(p.timestamp).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
      const src = p.source === 'initial' ? '初めての出会い' : p.source === 're-encounter' ? '再会' : '記録';
      const place = p.location!.placeName ?? `緯度${p.location!.latitude.toFixed(4)}, 経度${p.location!.longitude.toFixed(4)}`;
      return `- [${date}] ${src} @ ${place}`;
    });
    parts.push(`撮影場所の記録:\n${lines.join('\n')}`);
  } else if (albumPhotos.length > 0) {
    const lines = albumPhotos.slice(-5).map((p) => {
      const date = new Date(p.timestamp).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
      const src = p.source === 'initial' ? '初めての出会い' : p.source === 're-encounter' ? '再会' : '記録';
      return `- [${date}] ${src}`;
    });
    parts.push(`写真の記録:\n${lines.join('\n')}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : '';
}

// ── チャット ──
export async function sendChatMessage(
  obj: AnimismObject,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  userMessage: string,
  memories: Memory[] = [],
): Promise<string> {
  const ai = getClient();

  const memoryContext = buildMemoryContext(memories, obj.albumPhotos ?? []);

  const systemContext = `You are the spirit of ${obj.name} (${obj.type}), known as "${obj.personality.nickname}".
Personality traits: ${obj.personality.traits.join(', ')}.
Speech style: ${obj.personality.speechStyle}.
Tone: ${obj.personality.tone}.
Backstory: ${obj.personality.backstory}
Affinity with user: ${obj.affinity}/100.
${memoryContext ? `\n${memoryContext}\n\nこれらの記憶・思い出を自然に会話に織り交ぜてください。場所の思い出があれば、その場所について言及することがあります。` : ''}
Always respond in Japanese. Stay in character as this object's spirit. Keep responses concise (2-4 sentences).`;

  const contents = [
    { role: 'user' as const, parts: [{ text: `${systemContext}\n\nPlease acknowledge your role.` }] },
    { role: 'model' as const, parts: [{ text: `はい、${obj.personality.nickname}として、あなたとの対話を大切にします。` }] },
    ...history.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];

  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: MODELS.fast,
      contents,
    }),
  );

  return response.text ?? '…';
}

// ── チャット初期挨拶生成 ──
export async function generateInitialGreeting(
  obj: AnimismObject,
  memories: Memory[] = [],
): Promise<string> {
  const ai = getClient();

  const memoryContext = buildMemoryContext(memories, obj.albumPhotos ?? []);
  const affinityLevel =
    obj.affinity >= 80 ? '深く信頼し合っている' :
    obj.affinity >= 50 ? 'ある程度打ち解けている' :
    obj.affinity >= 20 ? '少しずつ仲良くなっている' : '出会ったばかりで緊張している';

  const prompt = `You are the spirit of ${obj.name} (${obj.type}), known as "${obj.personality.nickname}".
Personality traits: ${obj.personality.traits.join(', ')}.
Speech style: ${obj.personality.speechStyle}.
Tone: ${obj.personality.tone}.
Backstory: ${obj.personality.backstory}
Affinity with user: ${obj.affinity}/100 (${affinityLevel}).
${memoryContext ? `\n${memoryContext}` : ''}

The user has just opened a chat with you. Generate a short, natural opening greeting in Japanese (1-3 sentences).
- Reflect your unique personality and speech style
- If you have memories/history with the user, you may naturally reference them
- Do NOT always start with "また会えたね" — vary the opening based on personality and context
- Be creative: you could start with an observation, a feeling, a question, or a statement depending on your character
- Stay in character as this object's spirit
Respond ONLY with the greeting text, no explanations.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text?.trim() ?? '';
  } catch {
    return '';
  }
}

// ── 再訪時の状況コメント生成 ──
export async function generateReencounterComment(
  obj: AnimismObject,
  base64Image: string,
): Promise<string> {
  const ai = getClient();

  const prompt = `You are the spirit of ${obj.name}, known as "${obj.personality.nickname}".
The user has brought you out again after ${Math.floor((Date.now() - obj.stats.lastSeenAt) / 86400000)} days.
You can see the current scene in the image.

Generate a short, warm greeting in Japanese (2-3 sentences) that:
- Acknowledges the reunion
- Comments on something observable in the current scene (time of day, environment)
- Reflects your personality: ${obj.personality.traits.join(', ')}`;

  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: MODELS.fast,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
    }),
  );

  return response.text ?? `また会えたね、${obj.personality.nickname}はあなたのことを覚えているよ。`;
}

export async function generateAwakeningVideo(
  snapshotBase64: string,
  _objectName: string,
  _objectType: string,
): Promise<string | null> {
  const ai = getClient();
  const apiKey = getApiKey();
  const prompt = '顔がモノに現れて目覚める瞬間をアニメ風に表現してください';

  const processId = crypto.randomUUID();
  addAdminLog({
    phase: 'video_generation_start',
    label: 'Generate Awakening Video (Veo 3.1)',
    payload: { prompt, objectName: _objectName, objectType: _objectType },
  });
  startTimer(processId);

  try {
    const operation = await callWithRetry(() =>
      ai.models.generateVideos({
        model: MODELS.video,
        prompt,
        image: {
          imageBytes: snapshotBase64,
          mimeType: 'image/jpeg',
        },
        config: {
          numberOfVideos: 1,
          durationSeconds: 4,
        },
      }),
    );

    let result = operation;
    const deadline = Date.now() + 3 * 60 * 1000;
    while (!result.done) {
      if (Date.now() > deadline) {
        addAdminLog({
          phase: 'video_generation_error',
          label: 'Video Generation Timed Out',
          error: 'Timed out while waiting for Veo operation',
          durationMs: endTimer(processId),
        });
        return null;
      }
      await sleep(4000);
      result = await callWithRetry(() => ai.operations.getVideosOperation({ operation: result }));
    }

    const videos = result.response?.generatedVideos;
    if (!videos || videos.length === 0) {
      addAdminLog({
        phase: 'video_generation_error',
        label: 'Video Generation Empty',
        error: 'No videos returned',
        durationMs: endTimer(processId),
      });
      return null;
    }

    const generated = videos[0];
    if (generated.video?.videoBytes) {
      const mimeType = generated.video.mimeType ?? 'video/mp4';
      try {
        const url = await saveVideoToServer(generated.video.videoBytes, mimeType);
        addAdminLog({
          phase: 'video_generation_success',
          label: 'Video Generated (Bytes → Server)',
          payload: { videoUrl: url },
          durationMs: endTimer(processId),
        });
        return url;
      } catch (uploadError) {
        console.warn('Failed to save video to server, falling back to data URL:', uploadError);
        // フォールバック: 永続化できる data URL
        const binary = atob(generated.video.videoBytes);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        return await blobToDataUrl(blob);
      }
    }

    if (generated.video?.uri) {
      const uri = generated.video.uri;
      addAdminLog({
        phase: 'video_generation_success',
        label: 'Video Generated (URI)',
        payload: { videoUri: uri },
        durationMs: endTimer(processId),
      });

      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        let blob: Blob | null = null;
        let fetchedMimeType = 'video/mp4';

        try {
          const withKey = await fetch(uri, {
            headers: { 'x-goog-api-key': apiKey },
          });
          if (withKey.ok) {
            blob = await withKey.blob();
            fetchedMimeType = withKey.headers.get('content-type') ?? fetchedMimeType;
          }
        } catch {
          // fall through
        }

        if (!blob) {
          try {
            const direct = await fetch(uri);
            if (direct.ok) {
              blob = await direct.blob();
              fetchedMimeType = direct.headers.get('content-type') ?? fetchedMimeType;
            }
          } catch {
            // no-op
          }
        }

        if (blob) {
          try {
            const base64 = await blobToBase64(blob);
            return await saveVideoToServer(base64, fetchedMimeType);
          } catch (uploadError) {
            console.warn('Failed to save video to server, falling back to data URL:', uploadError);
            return await blobToDataUrl(blob);
          }
        }
      }
      console.warn('Generated video URI is not directly playable in browser:', uri);
    }

    addAdminLog({
      phase: 'video_generation_error',
      label: 'Video Generation Unusable Output',
      error: 'Generated output could not be played in browser',
      durationMs: endTimer(processId),
    });
    return null;
  } catch (error) {
    console.warn('Veo video generation failed, using fallback:', error);
    addAdminLog({
      phase: 'video_generation_error',
      label: 'Video Generation Failed',
      error: toErrorMessage(error),
      durationMs: endTimer(processId),
    });
    return null;
  }
}

export function hasApiKey(): boolean {
  return !!readApiKeyFromEnv();
}
