import type { AppScreen } from '../../lib/types';

interface Props {
  current: AppScreen;
  onChange: (screen: AppScreen) => void;
}

const items: { id: AppScreen; label: string; icon: string }[] = [
  { id: 'capture', label: 'スキャン', icon: '◎' },
  { id: 'collection', label: 'コレクション', icon: '✦' },
];

export function Navigation({ current, onChange }: Props) {
  if (current === 'chat' || current === 'detail') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-8 pb-6 pt-3"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 100%)',
        backdropFilter: 'blur(20px)',
      }}>
      {items.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all"
            style={{
              background: active ? 'rgba(168,85,247,0.15)' : 'transparent',
              border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
            }}
          >
            <span className="text-xl" style={{ color: active ? '#a855f7' : 'rgba(255,255,255,0.4)', textShadow: active ? '0 0 8px rgba(168,85,247,0.6)' : 'none' }}>
              {item.icon}
            </span>
            <span className="text-xs" style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
