/**
 * StreamCard - The Atomic Unit of Video Communication
 * 
 * Philosophy: Every stream is an entity with a lifecycle.
 * - Entrance: Smooth fade-in when stream becomes available
 * - Idle: Subtle breathing animation showing liveness
 * - Exit: Graceful departure when stream ends
 */

import { useRef, useEffect, useState } from 'react';
import { MicOff, Volume2, Maximize2, Pin } from 'lucide-react';

// Stream types - the different entities that can exist
export type StreamType = 'camera' | 'screen-share' | 'audio-only';

export interface StreamCardProps {
    stream: MediaStream | null;
    displayName: string;
    odId: string;
    streamType: StreamType;
    isMuted: boolean;
    isSpeaking?: boolean;
    isLocal?: boolean;
    isFocused?: boolean;
    size?: 'thumbnail' | 'medium' | 'focused';
    onClick?: () => void;
    onDoubleClick?: () => void;
    onPinToggle?: () => void;
    avatarUrl?: string;
}

export function StreamCard({
    stream,
    displayName,
    odId: _odId, // Destructured but unused - needed for key prop in parent
    streamType,
    isMuted,
    isSpeaking = false,
    isLocal = false,
    isFocused = false,
    size = 'medium',
    onClick,
    onDoubleClick,
    onPinToggle,
    avatarUrl,
}: StreamCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    // Audio is handled by ActiveCallModal, not here
    const [isHovered, setIsHovered] = useState(false);

    // Compute whether we have live video
    const hasLiveVideo = stream?.getVideoTracks().some(t =>
        t.readyState === 'live' && t.enabled
    ) && streamType !== 'audio-only';

    // Video element lifecycle management
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement || !stream || !hasLiveVideo) {
            return;
        }

        // Clear and set new stream
        videoElement.srcObject = null;
        videoElement.srcObject = stream;

        // Attempt to play
        videoElement.play().catch(err => {
            console.log('[StreamCard] Video play blocked:', displayName, err);
        });

        // Cleanup on unmount - CRITICAL for preventing frozen frames
        return () => {
            videoElement.srcObject = null;
        };
    }, [stream, hasLiveVideo, displayName]);

    // NOTE: Audio playback is handled by ActiveCallModal, not StreamCard
    // This prevents duplicate audio and allows centralized volume control

    // Size-based styling
    const sizeClasses = {
        thumbnail: 'w-32 h-24',
        medium: 'w-64 h-48',
        focused: 'w-full h-full',
    };

    // Speaking indicator ring
    const speakingRing = isSpeaking ? 'ring-2 ring-green-500 ring-opacity-75' : '';

    // Get initial for avatar fallback
    const initial = displayName.charAt(0).toUpperCase();

    return (
        <div
            className={`
                relative overflow-hidden rounded-xl bg-gray-900
                transition-all duration-300 ease-out
                ${sizeClasses[size]}
                ${speakingRing}
                ${isFocused ? 'ring-2 ring-blue-500' : ''}
                ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-gray-500' : ''}
                group
            `}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Audio is handled by ActiveCallModal, not individual cards */}

            {/* Video layer - only rendered when we have live video */}
            {hasLiveVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className={`
                        absolute inset-0 w-full h-full object-cover
                        ${isLocal ? 'transform scale-x-[-1]' : ''}
                    `}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
                    ) : (
                        <div className={`
                            flex items-center justify-center rounded-full
                            bg-gradient-to-br from-indigo-500 to-purple-600
                            ${size === 'thumbnail' ? 'w-10 h-10 text-lg' : 'w-20 h-20 text-3xl'}
                            font-bold text-white
                            ${isSpeaking ? 'animate-pulse' : ''}
                        `}>
                            {initial}
                        </div>
                    )}
                </div>
            )}

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* Name and status bar */}
            <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-2">
                <span className="text-white text-sm font-medium truncate">
                    {displayName}
                    {isLocal && <span className="text-gray-400 ml-1">(You)</span>}
                </span>

                <div className="flex items-center gap-1 ml-auto">
                    {isMuted && (
                        <div className="p-1 rounded-full bg-red-500/80">
                            <MicOff size={12} className="text-white" />
                        </div>
                    )}
                    {isSpeaking && !isMuted && (
                        <div className="p-1 rounded-full bg-green-500/80 animate-pulse">
                            <Volume2 size={12} className="text-white" />
                        </div>
                    )}
                </div>
            </div>

            {/* Hover controls overlay */}
            {isHovered && onClick && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onPinToggle && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                            title="Pin to focus"
                        >
                            <Pin size={14} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClick(); }}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                        title="Focus"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
            )}

            {/* Local indicator badge */}
            {isLocal && size !== 'focused' && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs bg-black/60 text-white">
                    You
                </div>
            )}
        </div>
    );
}
