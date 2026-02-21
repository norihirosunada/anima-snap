import { useRef, useState, useCallback, useEffect } from 'react';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null; // returns base64 JPEG (no prefix)
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false); // 重複呼び出し防止
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    if (startingRef.current || streamRef.current) return; // 既に起動中/起動済み
    startingRef.current = true;
    try {
      setError(null);
      const isPortrait = window.innerHeight > window.innerWidth;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: isPortrait ? 1080 : 1280 },
          height: { ideal: isPortrait ? 1920 : 720 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      // srcObject を設定する前に既存の再生を停止
      if (!video.paused) {
        video.pause();
      }
      video.srcObject = stream;

      // loadedmetadata を待ってから play() — AbortError を安全に処理
      await new Promise<void>((resolve) => {
        const onReady = () => {
          video.removeEventListener('loadedmetadata', onReady);
          resolve();
        };
        if (video.readyState >= 1) {
          resolve();
        } else {
          video.addEventListener('loadedmetadata', onReady);
        }
      });

      try {
        await video.play();
        setIsReady(true);
      } catch (playErr) {
        // AbortError は srcObject 変更時に起きる想定内エラーなので無視
        if (playErr instanceof DOMException && playErr.name === 'AbortError') {
          setIsReady(true);
        } else {
          throw playErr;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'カメラにアクセスできませんでした';
      setError(msg);
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    startingRef.current = false;
    setIsReady(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !isReady) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // strip "data:image/jpeg;base64," prefix
    return dataUrl.split(',')[1] ?? null;
  }, [isReady]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, isReady, error, startCamera, stopCamera, captureFrame };
}
