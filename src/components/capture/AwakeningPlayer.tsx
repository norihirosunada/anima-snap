import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AnimismObject } from '../../lib/types';

interface Props {
  object: AnimismObject;
  videoUrl: string | null;
  onComplete: () => void;
}

export function AwakeningPlayer({ object, videoUrl, onComplete }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<'loading' | 'playing' | 'reveal'>('loading');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraThreeRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameRef = useRef<number>(0);

  // Three.js particle awakening effect
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(75, w / h, 0.1, 100);
    cam.position.z = 3;
    cameraThreeRef.current = cam;

    // Particle system
    const COUNT = 3000;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const velocities: THREE.Vector3[] = [];

    const palette = [
      new THREE.Color(0xa855f7), // purple
      new THREE.Color(0x22d3ee), // cyan
      new THREE.Color(0xfbbf24), // gold
      new THREE.Color(0xec4899), // pink
    ];

    for (let i = 0; i < COUNT; i++) {
      // Start clustered in center
      const r = Math.random() * 0.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = Math.random() * 8 + 2;

      const speed = 0.01 + Math.random() * 0.04;
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          (Math.random() - 0.5) * speed + 0.01,
          (Math.random() - 0.5) * speed
        )
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    particlesRef.current = points;

    let t = 0;
    const animate = () => {
      t += 0.016;
      animFrameRef.current = requestAnimationFrame(animate);

      mat.opacity = Math.min(1, t * 0.5);

      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        pos.array[i * 3] += velocities[i].x;
        pos.array[i * 3 + 1] += velocities[i].y;
        pos.array[i * 3 + 2] += velocities[i].z;

        // gentle turbulence
        velocities[i].x += (Math.random() - 0.5) * 0.001;
        velocities[i].y += (Math.random() - 0.5) * 0.001;
      }
      pos.needsUpdate = true;

      points.rotation.y += 0.003;
      renderer.render(scene, cam);
    };
    animate();

    // Phase progression
    const t1 = setTimeout(() => setPhase('playing'), 500);
    const t2 = setTimeout(() => setPhase('reveal'), videoUrl ? 3000 : 4000);
    const t3 = setTimeout(() => onComplete(), videoUrl ? 8000 : 6000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Three.js canvas */}
      <div ref={canvasRef} className="absolute inset-0" />

      {/* Snapshot with reveal effect */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-1000"
        style={{
          opacity: phase === 'reveal' ? 1 : 0,
          transform: phase === 'reveal' ? 'scale(1)' : 'scale(0.8)',
        }}
      >
        {object.snapshotUrl && (
          <div className="relative">
            <img
              src={object.snapshotUrl}
              alt={object.name}
              className="w-64 h-64 object-contain rounded-2xl"
              style={{
                boxShadow: '0 0 60px rgba(168,85,247,0.8), 0 0 120px rgba(34,211,238,0.4)',
                filter: 'brightness(1.2) saturate(1.3)',
              }}
            />
            {/* Glow rings */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-2xl border border-purple-400/40"
                style={{
                  animation: `awakening-ring ${1.5 + i * 0.3}s ease-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video overlay (Veo) */}
      {videoUrl && phase === 'playing' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <video
            src={videoUrl}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ mixBlendMode: 'screen', opacity: 0.7 }}
          />
        </div>
      )}

      {/* Object name reveal */}
      <div
        className="absolute bottom-0 left-0 right-0 pb-20 text-center transition-all duration-700"
        style={{ opacity: phase === 'reveal' ? 1 : 0, transform: phase === 'reveal' ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="text-purple-300 text-xs tracking-widest mb-2 uppercase">Spirit Awakened</p>
        <h2 className="text-white text-3xl font-bold mb-1" style={{ textShadow: '0 0 20px rgba(168,85,247,0.8)' }}>
          {object.personality.nickname}
        </h2>
        <p className="text-white/60 text-sm">{object.name}</p>

        <button
          onClick={onComplete}
          className="mt-6 px-8 py-3 rounded-full text-sm font-medium transition-all active:scale-95"
          style={{
            background: 'rgba(168,85,247,0.2)',
            border: '1px solid rgba(168,85,247,0.5)',
            color: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          出会いを記念する →
        </button>
      </div>

      {/* Loading phase text */}
      {phase === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 animate-pulse"
              style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.6), transparent)', border: '1px solid rgba(168,85,247,0.5)' }}
            />
            <p className="text-purple-300 text-sm tracking-wider">魂が目覚めています…</p>
          </div>
        </div>
      )}
    </div>
  );
}
