import { useState, useEffect } from 'react';
import { getAdminLogs, clearAdminLogs } from '../../lib/logger';
import type { AdminLog } from '../../lib/logger';

interface Props {
    onBack: () => void;
}

export function AdminScreen({ onBack }: Props) {
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        // Initial load
        setLogs(getAdminLogs().reverse());

        // Listen for updates
        const handleUpdate = () => {
            setLogs(getAdminLogs().reverse());
        };

        window.addEventListener('admin-logs-updated', handleUpdate);
        return () => window.removeEventListener('admin-logs-updated', handleUpdate);
    }, []);

    const getPhaseColor = (phase: string) => {
        if (phase.includes('error')) return 'text-red-400 border-red-500/50 bg-red-500/10';
        if (phase.includes('success') || phase === 'object_registered') return 'text-green-400 border-green-500/50 bg-green-500/10';
        return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
    };

    const getDotColor = (phase: string) => {
        if (phase.includes('error')) return 'bg-red-400';
        if (phase.includes('success') || phase === 'object_registered') return 'bg-green-400';
        return 'bg-blue-400 animate-pulse';
    };

    return (
        <div className="w-full h-full bg-[#0a0a0f] text-white flex flex-col font-mono">
            {/* Header */}
            <div className="flex-none flex items-center justify-between p-4 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <button onClick={onBack} className="text-white/60 hover:text-white px-2 py-1 flex items-center gap-2">
                    <span>← Back to App</span>
                </button>
                <div className="flex items-center gap-4">
                    <h1 className="text-purple-400 font-bold tracking-widest text-sm uppercase">AI Process Logs</h1>
                    <button
                        onClick={() => clearAdminLogs()}
                        className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {logs.length === 0 ? (
                    <div className="text-center text-white/30 pt-20">No logs recorded yet.</div>
                ) : (
                    <div className="relative border-l border-white/10 ml-4 space-y-6 pb-20">
                        {logs.map((log) => {
                            const isExpanded = expandedId === log.id;

                            return (
                                <div key={log.id} className="relative pl-6">
                                    {/* Timeline Dot */}
                                    <div className={`absolute top-1.5 -left-1.5 w-3 h-3 rounded-full ${getDotColor(log.phase)} shadow-[0_0_10px_currentColor]`} />

                                    {/* Log Card */}
                                    <div
                                        className={`rounded-lg border ${getPhaseColor(log.phase)} transition-all overflow-hidden cursor-pointer`}
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                    >
                                        {/* Log Header */}
                                        <div className="px-4 py-3 flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-[10px] text-white/40">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</span>
                                                    {log.durationMs && (
                                                        <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded">{log.durationMs}ms</span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-sm text-white/90">{log.label}</h3>
                                                <p className="text-xs mt-1 opacity-70">{log.phase}</p>
                                            </div>

                                            {/* Error badge */}
                                            {log.error && (
                                                <div className="flex-none px-2 py-1 bg-red-500/20 text-red-200 text-xs rounded border border-red-500/30">
                                                    Error
                                                </div>
                                            )}
                                        </div>

                                        {/* Expandable Payload */}
                                        {isExpanded && (log.payload || log.error) && (
                                            <div className="px-4 py-3 border-t border-current bg-black/40 text-xs overflow-x-auto" onClick={(e) => e.stopPropagation()}>
                                                {log.error && (
                                                    <div className="text-red-400 mb-2 font-bold select-text">{log.error}</div>
                                                )}
                                                {log.payload && (
                                                    <pre className="text-white/70 select-text whitespace-pre-wrap">
                                                        {JSON.stringify(log.payload, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
