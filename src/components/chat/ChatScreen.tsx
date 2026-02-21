import { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, generateInitialGreeting } from '../../lib/gemini';
import { getMemories, addMemory } from '../../lib/storage';
import type { AnimismObject, Memory } from '../../lib/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

interface Props {
  object: AnimismObject;
  onBack: () => void;
}

function MemoryEntry({ memory }: { memory: Memory }) {
  const date = new Date(memory.timestamp);
  const label = memory.type === 'awakening' ? '✦ 覚醒' : memory.type === 're-encounter' ? '☽ 再会' : '✎ 記録';
  return (
    <div className="flex gap-3 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex flex-col items-center pt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
        <div className="w-px flex-1 mt-1" style={{ background: 'rgba(168,85,247,0.2)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-purple-400 text-xs">{label}</span>
          <span className="text-white/30 text-xs">
            {date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-white/60 text-xs leading-relaxed">{memory.content}</p>
        {memory.snapshotUrl && (
          <img src={memory.snapshotUrl} alt="" className="mt-2 w-16 h-16 rounded-lg object-cover opacity-60" />
        )}
      </div>
    </div>
  );
}

export function ChatScreen({ object, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGreeting, setIsGreeting] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<Array<{ role: 'user' | 'model'; text: string }>>([]);

  // パーソナリティに応じたフォールバック挨拶
  const getFallbackGreeting = useCallback(() => {
    const nick = object.personality.nickname;
    const affinity = object.affinity;
    const candidates =
      affinity >= 80 ? [
        `ん…来てくれたんだね。${nick}は、ずっと待ってたよ。`,
        `また会えた。${nick}としての私は、あなたのそばにいつもいる。`,
        `…声が聞きたかった。何でも話して。`,
      ] : affinity >= 40 ? [
        `あ、来てくれたんだ。${nick}として、ゆっくり話そうか。`,
        `おかえり。…少し、寂しかったかも。`,
        `${nick}だよ。今日はどんな気分？`,
      ] : [
        `…はじめまして、かな。${nick}という名で呼んでほしい。`,
        `あなたが話しかけてくれるの、待ってた。${nick}だよ。`,
        `そっか、あなたが私の主人なんだね。よろしく。`,
      ];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [object.personality.nickname, object.affinity]);

  useEffect(() => {
    const loadedMemories = getMemories(object.id);
    setMemories(loadedMemories);
    setIsGreeting(true);
    setMessages([]);
    historyRef.current = [];

    generateInitialGreeting(object, loadedMemories).then((text) => {
      const greetingText = text || getFallbackGreeting();
      const greeting: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: greetingText,
        timestamp: Date.now(),
      };
      setMessages([greeting]);
      historyRef.current = [{ role: 'model', text: greetingText }];
      setIsGreeting(false);
    });
  }, [object.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    setIsSending(true);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    historyRef.current.push({ role: 'user', text });

    try {
      const reply = await sendChatMessage(object, historyRef.current.slice(0, -1), text, memories);
      const modelMsg: ChatMessage = { id: crypto.randomUUID(), role: 'model', text: reply, timestamp: Date.now() };
      setMessages((prev) => [...prev, modelMsg]);
      historyRef.current.push({ role: 'model', text: reply });

      addMemory({ objectId: object.id, timestamp: Date.now(), type: 'chat', content: `${text} → ${reply.slice(0, 80)}` });
    } catch (e) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'model',
        text: '…うまく聞こえなかった。もう一度話しかけてみて。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, object]);

  return (
    <div className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #050010 0%, #0a0518 100%)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <span className="text-white text-sm">←</span>
        </button>

        {object.snapshotUrl && (
          <div className="relative flex-shrink-0">
            <img src={object.snapshotUrl} alt={object.name}
              className="w-10 h-10 rounded-full object-cover"
              style={{ boxShadow: '0 0 12px rgba(168,85,247,0.5)' }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-black" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{object.personality.nickname}</h3>
          <p className="text-white/40 text-xs truncate">{object.name}</p>
        </div>

        <button
          onClick={() => setShowMemories(!showMemories)}
          className="text-purple-400 text-xs px-3 py-1.5 rounded-full flex-shrink-0"
          style={{ background: showMemories ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)' }}>
          記憶
        </button>
      </div>

      {/* Memory timeline */}
      {showMemories && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-white/30 text-xs mb-3 text-center">— 記憶のタイムライン —</p>
          {memories.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-8">まだ記憶がありません</p>
          ) : (
            memories.slice().reverse().map((m) => <MemoryEntry key={m.id} memory={m} />)
          )}
        </div>
      )}

      {/* Chat messages */}
      {!showMemories && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'model' && object.snapshotUrl && (
                <img src={object.snapshotUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                  style={{ boxShadow: '0 0 8px rgba(168,85,247,0.4)' }} />
              )}
              <div
                className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={msg.role === 'user' ? {
                  background: 'rgba(168,85,247,0.3)',
                  border: '1px solid rgba(168,85,247,0.4)',
                  color: '#fff',
                  borderBottomRightRadius: '4px',
                } : {
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.85)',
                  borderBottomLeftRadius: '4px',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {(isSending || isGreeting) && (
            <div className="flex justify-start gap-2">
              {object.snapshotUrl && (
                <img src={object.snapshotUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1" />
              )}
              <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400"
                      style={{ animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-8 pt-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
              placeholder="メッセージを入力…"
              rows={1}
              className="w-full bg-transparent text-white text-sm resize-none outline-none placeholder-white/30"
              style={{ maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || isGreeting}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(168,85,247,0.6)', border: '1px solid rgba(168,85,247,0.8)' }}>
            <span className="text-white text-sm">↑</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
