import type { QuestionItem, QuestionnaireAnswer } from '../../lib/types';
import { useEffect, useState } from 'react';

interface Props {
  questions: QuestionItem[];
  answers: QuestionnaireAnswer[];
  onAnswer: (question: string, answer: string) => void;
  currentIndex: number;
  affinityScore: number;
}

const FALLBACK_OPTIONS = ['とてもそう思う', 'どちらかといえばそう思う', 'どちらとも言えない', 'あまりそう思わない'];

export function QuickReplyModal({ questions, answers, onAnswer, currentIndex, affinityScore }: Props) {
  const current = questions[currentIndex];
  // 20秒のプログレスバー用のアニメーション状態
  const [timeLeft, setTimeLeft] = useState(20);

  useEffect(() => {
    if (!current) return;
    setTimeLeft(20);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onAnswer(current.question, "無回答");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [current, onAnswer]);

  if (!current) return null;

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const affinityColor = affinityScore > 60 ? 'bg-purple-500' : affinityScore > 30 ? 'bg-cyan-500' : 'bg-blue-500';

  const normalizedOptions = [
    ...new Set(
      (current.options ?? [])
        .filter((option): option is string => typeof option === 'string')
        .map((option) => option.trim())
        .filter((option) => option.length > 0),
    ),
  ];

  const displayOptions = normalizedOptions.length >= 3
    ? normalizedOptions
    : [...normalizedOptions, ...FALLBACK_OPTIONS.filter((option) => !normalizedOptions.includes(option))]
      .slice(0, 4);

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col justify-between"
      onClick={() => onAnswer(current.question, "無回答")}
    >
      {/* Top Area: Question and Status */}
      <div
        className="pt-16 px-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' }} className="absolute top-0 left-0 right-0 h-48 -z-10 pointer-events-none" />

        {/* Affinity bar & Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-xs text-purple-200 font-medium drop-shadow-md">同期率</span>
            <span className="text-xs text-purple-200 drop-shadow-md">{affinityScore}%</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${affinityColor}`}
              style={{ width: `${affinityScore}%`, boxShadow: '0 0 8px currentColor' }}
            />
          </div>
          <div className="h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/60 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div
          className="rounded-2xl p-5 shadow-xl max-h-[68vh] overflow-y-auto"
          style={{ background: 'rgba(15,10,30,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(168,85,247,0.4)' }}
        >
          {answers.length > 0 && (
            <div className="mb-3 space-y-1">
              {answers.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-purple-400 text-xs">✓</span>
                  <span className="text-white/70 text-xs italic">{a.answer === "無回答" ? "（スキップ）" : a.answer}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-white font-medium text-base md:text-lg leading-relaxed drop-shadow-md">{current.question}</p>

          {/* Time Remaining Bar */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-400 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(timeLeft / 20) * 100}%` }}
              />
            </div>
            <span className="text-xs text-purple-300 w-6 text-right">{timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* Bottom Area: Options floating */}
      <div
        className="pb-24 px-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }} className="absolute bottom-0 left-0 right-0 h-64 -z-10 pointer-events-none" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayOptions.map((option) => (
            <button
              key={option}
              onClick={() => onAnswer(current.question, option)}
              className="py-4 px-3 rounded-2xl text-sm font-medium transition-all duration-200 active:scale-95 shadow-xl"
              style={{
                background: 'rgba(168,85,247,0.2)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(168,85,247,0.6)',
                color: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="text-white/50 text-xs mt-6 text-center drop-shadow-md">
          背景をタップでスキップ
        </p>
      </div>
    </div>
  );
}
