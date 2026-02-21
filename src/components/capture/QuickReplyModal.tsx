import type { QuestionItem, QuestionnaireAnswer } from '../../lib/types';

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
      className="absolute inset-0 z-40 flex flex-col justify-end"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)' }}
    >
      <div className="px-6 mb-3">
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

      <div className="px-6 mb-2">
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/40 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="px-4 pb-6">
        <div
          className="rounded-2xl p-5 max-h-[68vh] overflow-y-auto"
          style={{ background: 'rgba(15,10,30,0.88)', backdropFilter: 'blur(20px)', border: '1px solid rgba(168,85,247,0.3)' }}
        >
          {answers.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {answers.map((answer, i) => (
                <span
                  key={`answer-${i}`}
                  className="px-2 py-1 rounded-lg text-[11px]"
                  style={{ background: 'rgba(168,85,247,0.15)', color: 'rgba(255,255,255,0.75)' }}
                >
                  {answer.answer}
                </span>
              ))}
            </div>
          )}

          <p className="text-white font-medium mb-4 text-sm leading-relaxed">{current.question}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[36vh] overflow-y-auto pr-1">
            {displayOptions.map((option, index) => (
              <button
                key={`${current.id}-${index}-${option}`}
                onClick={() => onAnswer(current.question, option)}
                className="py-3 px-3 rounded-xl text-sm text-left font-medium transition-all duration-200 active:scale-95 hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.24), rgba(59,130,246,0.18))',
                  border: '1px solid rgba(168,85,247,0.45)',
                  color: 'rgba(255,255,255,0.95)',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <p className="text-white/35 text-xs mt-3 text-center">選択すると次の質問へ進みます</p>
        </div>
      </div>
    </div>
  );
}
