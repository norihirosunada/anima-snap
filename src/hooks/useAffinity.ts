import { useRef, useCallback } from 'react';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const COLORS = [
  'rgba(168, 85, 247, ',  // purple
  'rgba(34, 211, 238, ',  // cyan
  'rgba(251, 191, 36, ',  // gold
  'rgba(236, 72, 153, ',  // pink
  'rgba(52, 211, 153, ',  // emerald
];

export function useAffinity(onAffinityGain: (delta: number) => void) {
  const particlesRef = useRef<Particle[]>([]);
  const counterRef = useRef(0);
  const lastPointerRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const strokeSpeedRef = useRef(0);
  const accumulatorRef = useRef(0);

  const spawnParticles = useCallback((x: number, y: number, intensity: number = 1) => {
    const count = Math.floor(3 * intensity) + 1;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3 * intensity;
      const colorBase = COLORS[Math.floor(Math.random() * COLORS.length)];
      particlesRef.current.push({
        id: counterRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        maxLife: 40 + Math.random() * 30,
        size: 3 + Math.random() * 5 * intensity,
        color: colorBase,
      });
    }
    // trim to max 150
    if (particlesRef.current.length > 150) {
      particlesRef.current = particlesRef.current.slice(-150);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = Date.now();

      if (lastPointerRef.current) {
        const dx = x - lastPointerRef.current.x;
        const dy = y - lastPointerRef.current.y;
        const dt = now - lastPointerRef.current.time;
        const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 1);
        strokeSpeedRef.current = speed;

        if (speed > 0.5) {
          const intensity = Math.min(speed / 5, 3);
          spawnParticles(x, y, intensity);

          // accumulate affinity
          accumulatorRef.current += speed * 0.01;
          if (accumulatorRef.current >= 1) {
            onAffinityGain(Math.floor(accumulatorRef.current));
            accumulatorRef.current = accumulatorRef.current % 1;
          }
        }
      }

      lastPointerRef.current = { x, y, time: now };
    },
    [spawnParticles, onAffinityGain]
  );

  const handlePointerUp = useCallback(() => {
    lastPointerRef.current = null;
    strokeSpeedRef.current = 0;
  }, []);

  const updateParticles = useCallback(() => {
    particlesRef.current = particlesRef.current
      .map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy - 0.05, // gravity upward
        life: p.life - 1 / p.maxLife,
        vx: p.vx * 0.98,
      }))
      .filter((p) => p.life > 0);
    return particlesRef.current;
  }, []);

  const drawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);
      const particles = updateParticles();
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.life + ')';
        ctx.fill();

        // glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2 * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.life * 0.3 + ')';
        ctx.fill();
      }
    },
    [updateParticles]
  );

  return {
    particlesRef,
    handlePointerMove,
    handlePointerUp,
    drawParticles,
    strokeSpeedRef,
  };
}
