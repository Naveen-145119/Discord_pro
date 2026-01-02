import { useRef, useEffect, useState } from 'react';
import { Maximize, Minimize, X } from 'lucide-react';

interface ScreenShareViewerProps {
    stream: MediaStream;
    sharerName: string;
    onClose?: () => void;
    isSelf?: boolean;
}

export function ScreenShareViewer({
    stream,
    sharerName,
    onClose,
    isSelf = false,
}: ScreenShareViewerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;

        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black rounded-lg overflow-hidden group flex items-center justify-center"
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isSelf} // Mute self to avoid echo
                className="max-w-full max-h-full w-auto h-auto object-contain"
                style={{ 
                    // Ensure the video maintains aspect ratio and fits within container
                    objectFit: 'contain',
                }}
            />

            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-white">
                            {isSelf ? 'You are sharing your screen' : `${sharerName} is sharing their screen`}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>

                        {isSelf && onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-600 transition-colors"
                                title="Stop sharing"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Full Screen Capture</span>
                    <span>High Quality</span>
                </div>
            </div>
        </div>
    );
}
