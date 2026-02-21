import { useState, useEffect, useRef, useCallback } from 'react';
import { useCamera } from '../../hooks/useCamera';
import {
  analyzeFrame,
  generateQuestions,
  generatePersonality,
  generateAwakeningVideo,
  generateReencounterComment,
  hasApiKey,
} from '../../lib/gemini';
import { saveObject, recordEncounter, addMemory, getCollectionList, addObjectPhoto } from '../../lib/storage';
import { captureLocation } from '../../lib/geolocation';
import type { CaptureState, AnimismObject, QuestionItem, QuestionnaireAnswer } from '../../lib/types';
import { CameraView } from './CameraView';
import { QuickReplyModal } from './QuickReplyModal';
import { AwakeningPlayer } from './AwakeningPlayer';
import { addAdminLog } from '../../lib/logger';

interface Props {
  onObjectRegistered: (obj: AnimismObject) => void;
  onOpenCollection: () => void;
}

export function CaptureScreen({ onObjectRegistered, onOpenCollection }: Props) {
  const camera = useCamera();
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [affinityScore, setAffinityScore] = useState(0);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [newObject, setNewObject] = useState<AnimismObject | null>(null);
  const [awakeningVideoUrl, setAwakeningVideoUrl] = useState<string | null>(null);
  const [awakeningVideoReady, setAwakeningVideoReady] = useState(false);
  const [reencounterObj, setReencounterObj] = useState<AnimismObject | null>(null);
  const [reencounterComment, setReencounterComment] = useState<string>('');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);
  const videoPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (!hasApiKey()) setApiKeyMissing(true);
    camera.startCamera();
    return () => camera.stopCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAffinityGain = useCallback((delta: number) => {
    setAffinityScore((prev) => Math.min(100, prev + delta * 0.5));
  }, []);

  const startScanning = useCallback(() => {
    if (!camera.isReady) return;
    setErrorMsg(null);
    setCaptureState('scanning');
    setAffinityScore(0);

    // 位置情報を並行して取得開始
    const locationPromise = captureLocation().catch(() => null);

    // Auto-capture after 2s
    const timer = setTimeout(async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setCaptureState('analyzing');

      const frame = camera.captureFrame();
      if (!frame) {
        setCaptureState('idle');
        isProcessingRef.current = false;
        return;
      }

      try {
        const [collections, location] = await Promise.all([
          Promise.resolve(getCollectionList()),
          locationPromise,
        ]);
        const result = await analyzeFrame(frame, collections);

        if (!result.isNew && result.matchedId) {
          // Re-encounter
          const existing = collections.find((c) => c.id === result.matchedId);
          if (existing) {
            const latestSnapshot = `data:image/jpeg;base64,${frame}`;
            const updatedObject = addObjectPhoto(existing.id, latestSnapshot, location ?? undefined) ?? existing;
            const comment = await generateReencounterComment(existing, frame);
            recordEncounter(updatedObject.id);
            addMemory({
              objectId: updatedObject.id,
              timestamp: Date.now(),
              type: 're-encounter',
              content: comment,
              snapshotUrl: latestSnapshot,
            });
            setReencounterObj(updatedObject);
            setReencounterComment(comment);
            setCaptureState('re-encounter');
          }
        } else {
          // New object — generate questions
          const qs = await generateQuestions(frame, result.objectName);
          setQuestions(qs);
          setAnswers([]);
          setCurrentQuestionIndex(0);

          // Store partial object data
          const now = Date.now();
          const partialObj: AnimismObject = {
            id: crypto.randomUUID(),
            name: result.objectName,
            type: result.objectType,
            personality: { traits: [], speechStyle: '', backstory: '', nickname: '', tone: '' },
            affinity: affinityScore,
            capturedAt: now,
            snapshotUrl: `data:image/jpeg;base64,${frame}`,
            albumPhotos: [{
              id: crypto.randomUUID(),
              url: `data:image/jpeg;base64,${frame}`,
              timestamp: now,
              source: 'initial',
              ...(location ? { location } : {}),
            }],
            stats: { totalEncounters: 1, lastSeenAt: now },
          };
          setNewObject(partialObj);

          // Kick off Veo 3.1 generation in the background concurrently
          videoPromiseRef.current = generateAwakeningVideo(frame, result.objectName, result.objectType)
            .catch((e) => {
              console.error('Background Veo error:', e);
              return null;
            });

          setCaptureState('questionnaire');
        }
      } catch (e) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : '解析に失敗しました');
        setCaptureState('idle');
      } finally {
        isProcessingRef.current = false;
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [camera, affinityScore]);

  const handleAnswer = useCallback(async (question: string, answer: string) => {
    const newAnswers = [...answers, { question, answer }];
    setAnswers(newAnswers);
    setAffinityScore((prev) => Math.min(100, prev + 5));

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      // All questions answered — generate personality and awakening
      if (!newObject) return;
      setCaptureState('awakening');
      setAwakeningVideoReady(false);

      try {
        const frame = newObject.snapshotUrl.split(',')[1];

        // Fetch personality and wait for background video generation to finish (or immediately if already done)
        const [personality, videoUrl] = await Promise.all([
          generatePersonality(frame, newObject.name, newObject.type, newAnswers),
          videoPromiseRef.current ?? Promise.resolve(null),
        ]);

        const finalAffinity = Math.min(100, affinityScore + newAnswers.length * 5);
        const completedObj: AnimismObject = {
          ...newObject,
          personality,
          affinity: finalAffinity,
          questionnaire: newAnswers,
          awakeningVideoUrl: videoUrl ?? undefined,
        };

        setNewObject(completedObj);
        setAwakeningVideoUrl(videoUrl);
        setAwakeningVideoReady(true);
        saveObject(completedObj);

        addMemory({
          objectId: completedObj.id,
          timestamp: Date.now(),
          type: 'awakening',
          content: `${completedObj.personality.nickname}が覚醒した。「${personality.backstory.slice(0, 60)}…」`,
          snapshotUrl: completedObj.snapshotUrl,
        });

      } catch (e) {
        console.error(e);
        if (newObject) {
          saveObject(newObject);
          setNewObject(newObject);
          setAwakeningVideoReady(true);
        }
      }
    }
  }, [answers, currentQuestionIndex, questions.length, newObject, affinityScore]);

  const handleAwakeningComplete = useCallback(() => {
    if (newObject) {
      addAdminLog({
        phase: 'object_registered',
        label: 'Flow Completed & Registered',
        payload: { id: newObject.id, name: newObject.name },
      });
      onObjectRegistered(newObject);
    }
    setCaptureState('idle');
    setNewObject(null);
    setAwakeningVideoUrl(null);
    setAwakeningVideoReady(false);
    videoPromiseRef.current = null;
    setAnswers([]);
    setQuestions([]);
  }, [newObject, onObjectRegistered]);

  // cleanup intervals
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <CameraView
        camera={camera}
        captureState={captureState}
        onAffinityGain={handleAffinityGain}
      />

      {/* Questionnaire overlay */}
      {captureState === 'questionnaire' && questions.length > 0 && (
        <QuickReplyModal
          questions={questions}
          answers={answers}
          onAnswer={handleAnswer}
          currentIndex={currentQuestionIndex}
          affinityScore={affinityScore}
        />
      )}

      {/* Awakening player */}
      {captureState === 'awakening' && newObject && (
        <AwakeningPlayer
          object={newObject}
          videoUrl={awakeningVideoUrl}
          videoReady={awakeningVideoReady}
          onComplete={handleAwakeningComplete}
        />
      )}

      {/* Re-encounter card */}
      {captureState === 're-encounter' && reencounterObj && (
        <div className="absolute inset-0 z-40 flex items-end justify-center pb-20"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}>
          <div className="w-full max-w-sm px-4">
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: 'rgba(15,10,30,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(168,85,247,0.4)' }}
            >
              {reencounterObj.snapshotUrl && (
                <img src={reencounterObj.snapshotUrl} alt={reencounterObj.name}
                  className="w-20 h-20 rounded-xl object-cover mx-auto mb-3"
                  style={{ boxShadow: '0 0 20px rgba(168,85,247,0.6)' }} />
              )}
              <p className="text-purple-300 text-xs mb-1">{reencounterObj.personality.nickname}</p>
              <h3 className="text-white font-bold text-lg mb-3">{reencounterObj.name}</h3>
              <p className="text-white/80 text-sm leading-relaxed mb-5">{reencounterComment}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setReencounterObj(null); setCaptureState('idle'); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                  閉じる
                </button>
                <button
                  onClick={() => { onObjectRegistered(reencounterObj); setReencounterObj(null); setCaptureState('idle'); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.5)', color: '#fff' }}>
                  話しかける
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Button (Minimal, Bottom Right) */}
      {(captureState === 'idle' || captureState === 'scanning') && (
        <div className="absolute bottom-12 right-6 z-40">
          <button onClick={onOpenCollection}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            aria-label="Collection">
            <span className="text-white/70 text-xl">☷</span>
          </button>
        </div>
      )}

      {/* Camera error */}
      {camera.error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
          <div className="text-center px-8">
            <p className="text-red-400 text-sm mb-4">{camera.error}</p>
            <button onClick={() => camera.startCamera()}
              className="px-6 py-2 rounded-full bg-purple-600 text-white text-sm">
              再試行
            </button>
          </div>
        </div>
      )}

      {/* API key missing */}
      {apiKeyMissing && (
        <div className="absolute top-20 left-4 right-4 z-30">
          <div className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)' }}>
            <p className="text-red-300 text-xs">VITE_GEMINI_API_KEY が未設定です</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="absolute top-20 left-4 right-4 z-30">
          <div className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)' }}>
            <p className="text-red-300 text-xs">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Capture button (Minimal) */}
      {captureState === 'idle' && camera.isReady && (
        <div className="absolute bottom-20 left-0 right-0 z-30 flex justify-center">
          <button
            onClick={startScanning}
            className="relative w-16 h-16 rounded-full transition-all active:scale-90 flex items-center justify-center group"
            style={{
              background: 'transparent',
              border: '2px solid rgba(255,255,255,0.6)',
            }}
          >
            <div className="w-12 h-12 rounded-full transition-all group-active:scale-90" style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(4px)' }} />
          </button>
        </div>
      )}

      {/* Cancel scanning */}
      {captureState === 'scanning' && (
        <div className="absolute bottom-20 left-0 right-0 z-30 flex justify-center">
          <button
            onClick={() => setCaptureState('idle')}
            className="px-6 py-3 rounded-full text-sm text-white/60 transition-colors active:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
