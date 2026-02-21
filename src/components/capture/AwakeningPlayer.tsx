import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AnimismObject } from '../../lib/types';

interface Props {
  object: AnimismObject;
  /** null = Veo 生成中、string = 生成完了 URL */
  videoUrl: string | null;
  /** true = Veo 生成完了済み (null の場合はフォールバック確定) */
  videoReady: boolean;
  onComplete: () => void;
}

type Phase = 'photo' | 'awakening' | 'playing' | 'reveal';

export function AwakeningPlayer({ object, videoUrl, videoReady, onComplete }: Props) {
  const particleContainerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const intensityRef = useRef(0.15);
  const animFrameRef = useRef<number>(0);
  const fadeFrameRef = useRef<number>(0);
  const revealShownRef = useRef(false);

  // DOM 直接操作用 refs（Reactの再レンダリングを挟まないため滑らか）
  const snapshotImgRef = useRef<HTMLImageElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // React state は最小限 — フェーズ管理のみ
  const [phase, setPhase] = useState<Phase>('photo');
  const [revealVisible, setRevealVisible] = useState(false);
  const [isWaitingVideoStart, setIsWaitingVideoStart] = useState(false);

  // ── Three.js パーティクル ──
  useEffect(() => {
    const container = particleContainerRef.current;
    if (!container) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(75, w / h, 0.1, 100);
    cam.position.z = 3;

    const COUNT = 3500;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const velocities: [number, number, number][] = [];

    const palette = [
      new THREE.Color(0xa855f7),
      new THREE.Color(0x22d3ee),
      new THREE.Color(0xfbbf24),
      new THREE.Color(0xec4899),
      new THREE.Color(0xffffff),
    ];

    for (let i = 0; i < COUNT; i++) {
      const r = Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = r * Math.cos(angle);
      positions[i * 3 + 1] = r * Math.sin(angle) - 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      const speed = 0.005 + Math.random() * 0.02;
      velocities.push([
        (Math.random() - 0.5) * speed,
        speed * (0.3 + Math.random() * 0.7),
        (Math.random() - 0.5) * speed * 0.3,
      ]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    scene.add(new THREE.Points(geo, mat));

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      mat.opacity += (intensityRef.current - mat.opacity) * 0.05;

      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        pos.array[i * 3] += velocities[i][0];
        pos.array[i * 3 + 1] += velocities[i][1];
        pos.array[i * 3 + 2] += velocities[i][2];

        const dist = Math.sqrt(pos.array[i * 3] ** 2 + pos.array[i * 3 + 1] ** 2);
        if (dist > 3 || pos.array[i * 3 + 1] > 2) {
          const nr = Math.random() * 0.4;
          const na = Math.random() * Math.PI * 2;
          pos.array[i * 3] = nr * Math.cos(na);
          pos.array[i * 3 + 1] = -0.5 + Math.random() * 0.3;
          pos.array[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        }

        velocities[i][0] += (Math.random() - 0.5) * 0.0005;
        velocities[i][1] += (Math.random() - 0.5) * 0.0002;
      }
      pos.needsUpdate = true;
      renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── photo → awakening: 1.5s 後パーティクル強化 ──
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('awakening');
      intensityRef.current = 0.6;
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Veo完了時: DOM直接操作でクロスフェード ──
  useEffect(() => {
    if (!videoReady) return;

    if (videoUrl && videoElRef.current) {
      const videoEl = videoElRef.current;
      let crossFadeStarted = false;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
      let revealTimer: ReturnType<typeof setTimeout> | null = null;

      const runFallback = () => {
        if (crossFadeStarted) return;
        setIsWaitingVideoStart(false);
        intensityRef.current = 0.8;
        fallbackTimer = setTimeout(() => {
          intensityRef.current = 0.3;
          showReveal();
        }, 1500);
      };

      const startCrossFade = () => {
        if (crossFadeStarted) return;
        crossFadeStarted = true;
        setIsWaitingVideoStart(false);
        setPhase('playing');
        intensityRef.current = 1.0;

        videoEl.play().catch(() => {
          // 再生開始に失敗したら暗転だけで終わるのを避けてフォールバック
          runFallback();
        });

        const DURATION = 1800;
        let start: number | null = null;
        const tick = (ts: number) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / DURATION, 1);
          const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; // ease in-out

          if (videoEl) videoEl.style.opacity = String(eased);
          if (snapshotImgRef.current) {
            snapshotImgRef.current.style.opacity = String(1 - eased * 0.9);
          }

          if (p < 1) {
            fadeFrameRef.current = requestAnimationFrame(tick);
          }
        };
        fadeFrameRef.current = requestAnimationFrame(tick);

        // 7.5s or 動画終了でリビール
        revealTimer = setTimeout(showReveal, 7500);
      };

      setIsWaitingVideoStart(true);
      videoEl.style.opacity = '0';

      const onVideoCanPlay = () => startCrossFade();
      const onVideoError = () => runFallback();
      videoEl.addEventListener('loadeddata', onVideoCanPlay, { once: true });
      videoEl.addEventListener('error', onVideoError, { once: true });

      // 一定時間ロードできなければフォールバック
      const tLoadTimeout = setTimeout(runFallback, 6000);
      if (videoEl.readyState >= 2) startCrossFade();

      return () => {
        clearTimeout(tLoadTimeout);
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (revealTimer) clearTimeout(revealTimer);
        videoEl.removeEventListener('loadeddata', onVideoCanPlay);
        videoEl.removeEventListener('error', onVideoError);
        cancelAnimationFrame(fadeFrameRef.current);
      };
    } else {
      // 動画なし: パーティクルのみでリビール
      intensityRef.current = 0.8;
      const t = setTimeout(() => {
        intensityRef.current = 0.3;
        showReveal();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [videoReady, videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const showReveal = () => {
    if (revealShownRef.current) return;
    revealShownRef.current = true;
    intensityRef.current = 0.3;
    setPhase('reveal');

    // snapshot を暗く
    if (snapshotImgRef.current) {
      snapshotImgRef.current.style.transition = 'opacity 1.2s ease, filter 1.2s ease';
      snapshotImgRef.current.style.opacity = '0.25';
      snapshotImgRef.current.style.filter = 'blur(2px) brightness(0.7)';
    }
    // ローダー非表示
    if (loaderRef.current) loaderRef.current.style.display = 'none';
    // リビール表示
    setRevealVisible(true);
  };

  const handleVideoEnded = () => showReveal();

  const snapshot = object.snapshotUrl;

  return (
    // overflow-hidden を外す — translateY クリップ問題を回避
    <div className="fixed inset-0 z-50 bg-black">

      {/* 1. スナップショット */}
      {snapshot && (
        <img
          ref={snapshotImgRef}
          src={snapshot}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: 1,
            filter: 'brightness(1)',
            transition: 'filter 0.5s ease',
          }}
        />
      )}

      {/* 2. Veo 動画 — 常に DOM に存在させ opacity で制御 */}
      {videoUrl && (
        <video
          ref={videoElRef}
          src={videoUrl}
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0 }}
        />
      )}

      {/* 3. パーティクルオーバーレイ */}
      <div
        ref={particleContainerRef}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* 4. reveal 用グラデーション */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 45%, transparent 100%)',
          opacity: revealVisible ? 1 : 0,
        }}
      />

      {/* 5. ローディング表示 */}
      <div
        ref={loaderRef}
        className="absolute left-0 right-0 flex flex-col items-center gap-3 pointer-events-none"
        style={{
          bottom: '140px',
          display: phase === 'awakening' && (!videoReady || isWaitingVideoStart) ? 'flex' : 'none',
        }}
      >
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-purple-400"
              style={{
                height: '12px',
                animation: `eq-bar 1s ${i * 0.12}s ease-in-out infinite alternate`,
                boxShadow: '0 0 6px rgba(168,85,247,0.8)',
              }}
            />
          ))}
        </div>
        <p className="text-purple-300/70 text-xs tracking-widest">魂が形を得ています…</p>
      </div>

      {/* 6. キャラクター名リビール — overflow せず下から出現 */}
      <div
        className="absolute left-0 right-0 px-6 text-center"
        style={{
          // safe area + 余白
          bottom: 0,
          paddingBottom: 'max(40px, env(safe-area-inset-bottom, 0px) + 32px)',
          paddingTop: '24px',
          // フェードイン（translateY は使わない — overflow clipping 回避）
          opacity: revealVisible ? 1 : 0,
          transition: 'opacity 0.9s ease',
          // pointer-events: none で非表示中はタップ不可
          pointerEvents: revealVisible ? 'auto' : 'none',
        }}
      >
        <p className="text-purple-300 text-xs tracking-[0.3em] mb-2 uppercase font-light">
          Spirit Awakened
        </p>
        <h2
          className="text-white text-3xl font-bold mb-1"
          style={{ textShadow: '0 0 30px rgba(168,85,247,0.9), 0 0 60px rgba(168,85,247,0.5)' }}
        >
          {object.personality.nickname}
        </h2>
        <p className="text-white/50 text-sm mb-6">{object.name}</p>

        <button
          onClick={onComplete}
          className="px-10 py-4 rounded-full text-sm font-medium transition-all active:scale-95"
          style={{
            background: 'rgba(168,85,247,0.25)',
            border: '1px solid rgba(168,85,247,0.7)',
            color: '#fff',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 24px rgba(168,85,247,0.4)',
          }}
        >
          出会いを記念する →
        </button>
      </div>

      <style>{`
        @keyframes eq-bar {
          from { transform: scaleY(0.5); opacity: 0.5; }
          to   { transform: scaleY(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
