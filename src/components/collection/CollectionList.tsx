import { useEffect, useState } from 'react';
import { getCollectionList } from '../../lib/storage';
import type { AnimismObject } from '../../lib/types';

interface Props {
  onSelectObject: (obj: AnimismObject) => void;
  onBack: () => void;
  refreshTrigger: number;
}

function AffinityBar({ value }: { value: number }) {
  const color = value > 70 ? '#a855f7' : value > 40 ? '#22d3ee' : '#60a5fa';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <span>同期率</span>
        <span>{value}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  );
}

function ObjectCard({ obj, onClick }: { obj: AnimismObject; onClick: () => void }) {
  const daysSince = Math.floor((Date.now() - obj.stats.lastSeenAt) / 86400000);

  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden text-left transition-all active:scale-95 w-full"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      {/* Snapshot */}
      <div className="relative aspect-square overflow-hidden">
        {obj.snapshotUrl ? (
          <img src={obj.snapshotUrl} alt={obj.name}
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.9) saturate(1.1)' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl"
            style={{ background: 'rgba(168,85,247,0.1)' }}>
            ✦
          </div>
        )}
        {/* Affinity overlay glow */}
        {obj.affinity > 60 && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.15), transparent 70%)' }} />
        )}
        {/* Last seen badge */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)' }}>
          {daysSince === 0 ? '今日' : `${daysSince}日前`}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-purple-300 text-xs mb-0.5 truncate">{obj.personality.nickname || '—'}</p>
        <h3 className="text-white font-semibold text-sm truncate">{obj.name}</h3>
        <AffinityBar value={obj.affinity} />
      </div>
    </button>
  );
}

export function CollectionList({ onSelectObject, onBack, refreshTrigger }: Props) {
  const [objects, setObjects] = useState<AnimismObject[]>([]);

  useEffect(() => {
    setObjects(getCollectionList());
  }, [refreshTrigger]);

  return (
    <div className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #0a0514 0%, #080010 100%)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <span className="text-white text-sm">←</span>
        </button>
        <div>
          <h2 className="text-white font-bold text-lg">コレクション</h2>
          <p className="text-white/40 text-xs">{objects.length} 体の魂</p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-4xl mb-4 animate-float">✦</div>
            <p className="text-white/40 text-sm">まだモノが登録されていません</p>
            <p className="text-white/30 text-xs mt-1">カメラでスキャンして魂を宿しましょう</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {objects.map((obj) => (
              <ObjectCard key={obj.id} obj={obj} onClick={() => onSelectObject(obj)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
