import { useState } from 'react';
import { getMemories } from '../../lib/storage';
import type { AnimismObject } from '../../lib/types';

interface Props {
  object: AnimismObject;
  onBack: () => void;
  onChat: () => void;
  onDelete: (id: string) => void;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-white font-bold text-lg">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  );
}

export function ObjectDetail({ object, onBack, onChat, onDelete }: Props) {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const memories = getMemories(object.id);
  const daysSince = Math.floor((Date.now() - object.capturedAt) / 86400000);
  const lastSeen = Math.floor((Date.now() - object.stats.lastSeenAt) / 86400000);
  const affinityColor = object.affinity > 70 ? '#a855f7' : object.affinity > 40 ? '#22d3ee' : '#60a5fa';
  const handleDelete = () => {
    const shouldDelete = window.confirm(`「${object.name}」をコレクションから削除しますか？`);
    if (!shouldDelete) return;
    onDelete(object.id);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, #08001a 0%, #0a0518 100%)' }}>
      {/* Back button */}
      <div className="flex items-center px-4 pt-12 pb-4 flex-shrink-0">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <span className="text-white text-sm">←</span>
        </button>
      </div>

      {/* Hero image */}
      <div className="relative mx-4 rounded-2xl overflow-hidden flex-shrink-0" style={{ height: '260px' }}>
        {object.snapshotUrl ? (
          <img src={object.snapshotUrl} alt={object.name}
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.85) saturate(1.2)' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl"
            style={{ background: 'rgba(168,85,247,0.1)' }}>✦</div>
        )}
        {/* Glow overlay */}
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center bottom, ${affinityColor}30, transparent 60%)` }} />
        {/* Rings */}
        {object.affinity > 50 && [1, 2].map((i) => (
          <div key={i} className="absolute inset-0 rounded-2xl border border-purple-400/20"
            style={{ animation: `awakening-ring ${2 + i * 0.5}s ease-out ${i * 0.5}s infinite` }} />
        ))}
      </div>

      {/* Name and nickname */}
      <div className="px-4 mt-5 flex-shrink-0">
        <p className="text-purple-400 text-xs tracking-widest uppercase mb-1">{object.type}</p>
        <h2 className="text-white text-2xl font-bold mb-0.5">{object.name}</h2>
        <p className="text-white/50 text-sm">
          <span className="text-cyan-400">「{object.personality.nickname}」</span>
        </p>
      </div>

      {/* Affinity */}
      <div className="px-4 mt-5 flex-shrink-0">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/50">同期率</span>
          <span style={{ color: affinityColor }}>{object.affinity}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${object.affinity}%`, background: `linear-gradient(90deg, ${affinityColor}, #fff)`, boxShadow: `0 0 10px ${affinityColor}` }} />
        </div>
      </div>

      {/* Traits */}
      {object.personality.traits.length > 0 && (
        <div className="px-4 mt-5 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {object.personality.traits.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full text-xs"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: 'rgba(255,255,255,0.8)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Backstory */}
      {object.personality.backstory && (
        <div className="mx-4 mt-5 rounded-2xl p-4 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-white/30 text-xs mb-2">精霊の物語</p>
          <p className="text-white/70 text-sm leading-relaxed">{object.personality.backstory}</p>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 mt-5 flex-shrink-0">
        <p className="text-white/30 text-xs mb-3">記録</p>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="一緒にいる日数" value={daysSince} />
          <StatCard label="観測回数" value={object.stats.totalEncounters} />
          <StatCard label="記憶の数" value={memories.length} />
        </div>
        {lastSeen > 0 && (
          <p className="text-white/30 text-xs mt-3 text-center">{lastSeen}日前に最後に会った</p>
        )}
      </div>

      {/* Album */}
      {object.albumPhotos.length > 0 && (
        <div className="px-4 mt-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/30 text-xs">アルバム</p>
            <p className="text-white/40 text-xs">{object.albumPhotos.length}枚</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {object.albumPhotos
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo.url)}
                  className="aspect-square rounded-xl overflow-hidden active:scale-95 transition-transform"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <img src={photo.url} alt={object.name} className="w-full h-full object-cover" />
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Speech style */}
      {object.personality.speechStyle && (
        <div className="px-4 mt-4 flex-shrink-0">
          <p className="text-white/30 text-xs mb-2">話し方</p>
          <p className="text-white/50 text-xs italic">{object.personality.speechStyle}</p>
        </div>
      )}

      {/* Action button */}
      <div className="px-4 mt-6 mb-10 flex-shrink-0 space-y-2">
        {object.awakeningVideoUrl && (
          <button
            onClick={() => setIsVideoOpen(true)}
            className="w-full py-3 rounded-2xl text-white/90 font-medium text-sm transition-all active:scale-98"
            style={{
              background: 'rgba(34,211,238,0.16)',
              border: '1px solid rgba(34,211,238,0.35)',
            }}>
            覚醒動画を再生する
          </button>
        )}
        <button
          onClick={onChat}
          className="w-full py-4 rounded-2xl text-white font-medium text-sm transition-all active:scale-98"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.6), rgba(34,211,238,0.3))',
            border: '1px solid rgba(168,85,247,0.5)',
            boxShadow: '0 0 30px rgba(168,85,247,0.3)',
          }}>
          {object.personality.nickname} に話しかける ✦
        </button>
        <button
          onClick={handleDelete}
          className="w-full py-3 rounded-2xl text-sm font-medium transition-all active:scale-98"
          style={{
            color: 'rgba(248,113,113,0.95)',
            background: 'rgba(127,29,29,0.2)',
            border: '1px solid rgba(248,113,113,0.35)',
          }}>
          このコレクションを削除
        </button>
      </div>

      {isVideoOpen && object.awakeningVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,8,20,0.96)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <video
              src={object.awakeningVideoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-auto"
            />
            <div className="p-3">
              <button
                onClick={() => setIsVideoOpen(false)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-md">
            <img src={selectedPhoto} alt={object.name} className="w-full h-auto rounded-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.18)' }} />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
