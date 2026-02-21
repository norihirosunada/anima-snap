import { useEffect, useRef } from 'react';
import type { UseCameraReturn } from '../../hooks/useCamera';
import type { CaptureState } from '../../lib/types';
import { useAffinity } from '../../hooks/useAffinity';

interface Props {
  camera: UseCameraReturn;
  captureState: CaptureState;
  onAffinityGain: (delta: number) => void;
}

export function CameraView({ camera, captureState, onAffinityGain }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const { handlePointerMove, handlePointerUp, drawParticles } = useAffinity(onAffinityGain);

  const interactive = captureState === 'questionnaire';

  // Particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      drawParticles(ctx, canvas.width, canvas.height);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawParticles]);

  // Keep canvas size synced
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Camera feed */}
      {/* autoPlay を使わず useCamera の play() に委ねる */}
      <video
        ref={camera.videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Particle canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Touch interaction layer */}
      {interactive && (
        <div
          className="absolute inset-0 z-20 cursor-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      )}

      {/* Scanning overlay */}
      {captureState === 'scanning' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          {/* Corner brackets */}
          <div className="relative w-64 h-64">
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
              <div
                key={pos}
                className={`absolute w-8 h-8 border-purple-400 border-2 ${
                  pos === 'top-left' ? 'top-0 left-0 border-r-0 border-b-0' :
                  pos === 'top-right' ? 'top-0 right-0 border-l-0 border-b-0' :
                  pos === 'bottom-left' ? 'bottom-0 left-0 border-r-0 border-t-0' :
                  'bottom-0 right-0 border-l-0 border-t-0'
                }`}
              />
            ))}
            {/* Scanning line */}
            <div className="absolute left-1 right-1 h-px bg-purple-400 opacity-80"
              style={{ top: '50%', boxShadow: '0 0 8px rgba(168,85,247,0.8)', animation: 'scan-line 2s linear infinite' }}
            />
          </div>
        </div>
      )}

      {/* Analyzing overlay */}
      {captureState === 'analyzing' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-purple-300 text-sm font-medium text-glow">魂を読み取っています…</p>
          </div>
        </div>
      )}

      {/* Dark vignette for aesthetics */}
      <div className="absolute inset-0 pointer-events-none z-5"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)' }}
      />

      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
