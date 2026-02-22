import { useEffect, useState } from 'react';

interface SplashScreenProps {
    onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Show splash for 2s, then start fade out
        const timer1 = setTimeout(() => {
            setFadeOut(true);
        }, 2000);

        // After fade out transition (500ms), unmount
        const timer2 = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [onComplete]);

    return (
        <div
            className={`fixed inset-0 bg-black flex flex-col items-center justify-center z-[100] transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'
                }`}
        >
            <div className="flex flex-col items-center animate-pulse">
                {/* Simple Camera/Spiritual Logo SVG */}
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white mb-6"
                >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                    <path d="M12 8v.01" />
                    <path d="M12 18v.01" />
                    <path d="M7 13h.01" />
                    <path d="M17 13h.01" />
                </svg>

                <h1
                    className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-white to-gray-200 uppercase"
                    style={{ letterSpacing: '0.2em' }}
                >
                    Animism Snap
                </h1>
                <p className="mt-4 text-sm tracking-widest text-gray-400 uppercase opacity-70">
                    Soul-Capture Camera
                </p>
            </div>
        </div>
    );
}
