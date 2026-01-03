/**
 * ScreenShareCard - A specialized stream card for screen sharing
 * Features: LIVE badge, fullscreen toggle, stop sharing button
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Maximize, Minimize, X, MonitorUp } from 'lucide-react';

export interface ScreenShareCardProps {
    stream: MediaStream;
    sharerName: string;
    sharerId: string;
    isLocal?: boolean;
    isFocused?: boolean;
    onStopSharing?: () => void;
    onClick?: () => void;
}

export function ScreenShareCard({
    stream,
    sharerName,
    sharerId: _sharerId, // Used for key in parent
    isLocal = false,
    isFocused = false,
    onStopSharing,
    onClick,
}: ScreenShareCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [streamInfo, setStreamInfo] = useState({ width: 0, height: 0, fps: 30 });
    const [isHovered, setIsHovered] = useState(false);

    // Video lifecycle management
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement || !stream) return;

        videoElement.srcObject = null;
        videoElement.srcObject = stream;

        const playVideo = async () => {
            try {
                await videoElement.play();
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    setStreamInfo({
                        width: settings.width || 0,
                        height: settings.height || 0,
                        fps: settings.frameRate || 30,
                    });
                }
            } catch (err) {
                console.log('[ScreenShareCard] Play blocked:', err);
            }
        };

        playVideo();

        return () => {
            videoElement.srcObject = null;
        };
    }, [stream]);

    const toggleFullscreen = useCallback(async () => {
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
            console.error('[ScreenShareCard] Fullscreen error:', error);
        }
    }, []);

    useEffect(() => {
        const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, []);

    const resolutionText = streamInfo.width && streamInfo.height
        ? `${streamInfo.height}P`
        : '';

    return (
        <div
            ref={containerRef}
            className={`
                relative overflow-hidden rounded-xl bg-black
                transition-all duration-300 ease-out
                ${isFocused ? 'w-full h-full' : 'aspect-video'}
                group
            `}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className="w-full h-full object-contain"
            />

            {/* Header overlay - Discord style */}
            {isFocused ? (
                // Focused view: Name at top-left, badges at top-right (always visible)
                <>
                    {/* Top-left: Sharer name with screen icon */}
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-lg">
                        <MonitorUp size={16} className="text-white" />
                        <span className="text-white text-sm font-semibold">
                            {sharerName}
                        </span>
                    </div>

                    {/* Top-right: Resolution + LIVE badges */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {resolutionText && (
                            <div className="px-2 py-1 bg-black/60 rounded text-white text-xs font-medium">
                                {resolutionText} {Math.round(streamInfo.fps)}FPS
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded text-white text-xs font-bold">
                            LIVE
                        </div>
                    </div>
                </>
            ) : (
                // Grid view: LIVE badge at top-right, name pill at bottom-left
                <>
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded text-white text-xs font-bold">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 bg-black/60 rounded">
                        <MonitorUp size={12} className="text-white" />
                        <span className="text-white text-xs font-medium truncate max-w-[100px]">
                            {sharerName.replace("'s screen", "")}
                        </span>
                    </div>
                </>
            )}

            {/* Controls - show on hover */}
            <div className={`absolute top-3 right-3 flex items-center gap-2 transition-opacity ${!isFocused && isHovered ? 'opacity-100' : isFocused ? 'opacity-0' : 'opacity-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
                {isLocal && onStopSharing && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onStopSharing(); }}
                        className="p-2 rounded-lg bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                        title="Stop sharing"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}
