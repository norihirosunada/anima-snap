import type { QuestionItem, QuestionnaireAnswer } from '../../lib/types';

interface Props {
  questions: QuestionItem[];
  answers: QuestionnaireAnswer[];
  onAnswer: (question: string, answer: string) => void;
  currentIndex: number;
  affinityScore: number;
}

export function QuickReplyModal({ questions, answers, onAnswer, currentIndex, affinityScore }: Props) {
  const current = questions[currentIndex];
  if (!current) return null;

  const progress = (currentIndex / questions.length) * 100;
  const affinityColor = affinityScore > 60 ? 'bg-purple-500' : affinityScore > 30 ? 'bg-cyan-500' : 'bg-blue-500';

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }}>

      {/* Affinity bar */}
      <div className="px-6 mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-purple-300 font-medium">同期率</span>
          <span className="text-xs text-purple-300">{affinityScore}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${affinityColor}`}
            style={{ width: `${affinityScore}%`, boxShadow: '0 0 8px currentColor' }}
          />
        </div>
      </div>

      {/* Question progress */}
      <div className="px-6 mb-2">
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/40 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="px-4 pb-8">
        <div
          className="rounded-2xl p-5"
          style={{ background: 'rgba(15,10,30,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(168,85,247,0.3)' }}
        >
          {/* Past answers */}
          {answers.length > 0 && (
            <div className="mb-4 space-y-1">
              {answers.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-purple-400 text-xs">✓</span>
                  <span className="text-white/50 text-xs">{a.answer}</span>
                </div>
              ))}
            </div>
          )}

          {/* Current question */}
          <p className="text-white font-medium mb-4 text-sm leading-relaxed">{current.question}</p>

          {/* Options */}
          <div className="grid grid-cols-2 gap-2">
            {current.options.map((option) => (
              <button
                key={option}
                onClick={() => onAnswer(current.question, option)}
                className="py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
                style={{
                  background: 'rgba(168,85,247,0.15)',
                  border: '1px solid rgba(168,85,247,0.4)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Hint */}
          <p className="text-white/30 text-xs mt-3 text-center">
            タッチして撫でると同期率が上がります ✦
          </p>
        </div>
      </div>
    </div>
  );
}
