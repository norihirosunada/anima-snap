// ── Admin Logs ──

export type LogPhase =
    | 'capture_start'
    | 'image_analysis_start'
    | 'image_analysis_success'
    | 'image_analysis_error'
    | 'question_generation_start'
    | 'question_generation_success'
    | 'question_generation_error'
    | 'personality_generation_start'
    | 'personality_generation_success'
    | 'personality_generation_error'
    | 'video_generation_start'
    | 'video_generation_success'
    | 'video_generation_error'
    | 'object_registered';

export interface AdminLog {
    id: string;
    timestamp: number;
    phase: LogPhase;
    label: string;
    payload?: any;
    error?: string;
    durationMs?: number;
}

const LOGS_KEY = 'animism_snap_admin_logs';

export function getAdminLogs(): AdminLog[] {
    try {
        const raw = localStorage.getItem(LOGS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function clearAdminLogs(): void {
    localStorage.removeItem(LOGS_KEY);
    window.dispatchEvent(new Event('admin-logs-updated'));
}

export function addAdminLog(log: Omit<AdminLog, 'id' | 'timestamp'>): void {
    const logs = getAdminLogs();
    const newLog: AdminLog = {
        ...log,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    };

    // Keep latest 1000 logs
    logs.push(newLog);
    const trimmed = logs.slice(-1000);

    localStorage.setItem(LOGS_KEY, JSON.stringify(trimmed));

    // Dispatch event for real-time UI updates
    window.dispatchEvent(new Event('admin-logs-updated'));
}

// ── Timing Utility ──
const activeTimers = new Map<string, number>();

export function startTimer(processId: string) {
    activeTimers.set(processId, performance.now());
}

export function endTimer(processId: string): number | undefined {
    const start = activeTimers.get(processId);
    if (start === undefined) return undefined;
    activeTimers.delete(processId);
    return Math.round(performance.now() - start);
}
