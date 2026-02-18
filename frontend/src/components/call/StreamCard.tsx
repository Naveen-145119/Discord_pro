/**
 * StreamCard - The Atomic Unit of Video Communication
 * 
 * Philosophy: Every stream is an entity with a lifecycle.
 * - Entrance: Smooth fade-in when stream becomes available
 * - Idle: Subtle breathing animation showing liveness
 * - Exit: Graceful departure when stream ends
 */

import { useRef, useEffect, useState } from 'react';
import { MicOff, Maximize2, Pin } from 'lucide-react';

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
    odId: _odId,
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
    const [isHovered, setIsHovered] = useState(false);

    // ── Reactive hasLiveVideo ─────────────────────────────────────────────────
    // CRITICAL: This MUST be a useState, not a plain variable.
    // When a remote track's readyState changes from 'live' to 'ended',
    // React does NOT re-render automatically — it only re-renders when props change.
    // By subscribing to track events, we force a re-render exactly when needed.
    const computeHasLiveVideo = () =>
        streamType !== 'audio-only' &&
        !!stream?.getVideoTracks().some(t => t.readyState === 'live' && t.enabled && !t.muted);

    const [hasLiveVideo, setHasLiveVideo] = useState(computeHasLiveVideo);

    useEffect(() => {
        // Recompute immediately when stream or streamType changes
        setHasLiveVideo(computeHasLiveVideo());

        if (!stream || streamType === 'audio-only') return;

        const update = () => setHasLiveVideo(computeHasLiveVideo());

        // Subscribe to track-level events so we react to readyState changes
        const tracks = stream.getVideoTracks();
        tracks.forEach(track => {
            track.addEventListener('ended', update);
            track.addEventListener('mute', update);
            track.addEventListener('unmute', update);
        });

        // Subscribe to stream-level events for track add/remove
        stream.addEventListener('removetrack', update);
        stream.addEventListener('addtrack', update);

        return () => {
            tracks.forEach(track => {
                track.removeEventListener('ended', update);
                track.removeEventListener('mute', update);
                track.removeEventListener('unmute', update);
            });
            stream.removeEventListener('removetrack', update);
            stream.removeEventListener('addtrack', update);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream, streamType]);

    // ── Video element lifecycle ───────────────────────────────────────────────
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        if (!stream || !hasLiveVideo) {
            // Explicitly clear srcObject — browser stops painting the last frame
            if (videoElement.srcObject !== null) {
                videoElement.srcObject = null;
            }
            return;
        }

        // Only update srcObject if the stream actually changed
        if (videoElement.srcObject !== stream) {
            videoElement.srcObject = null; // clear first to force repaint
            videoElement.srcObject = stream;
        }

        videoElement.play().catch(err => {
            console.log('[StreamCard] Video play blocked:', displayName, err);
        });

        return () => {
            videoElement.srcObject = null;
        };
    }, [stream, hasLiveVideo, displayName]);

    // NOTE: Audio playback is handled by ActiveCallModal, not StreamCard
    // This prevents duplicate audio and allows centralized volume control

    // Size-based styling - Discord style with aspect ratio
    const sizeClasses = {
        thumbnail: 'w-[140px] h-[100px]',
        medium: 'w-full aspect-video',
        focused: 'w-full max-w-[900px] aspect-video',
    };

    // Speaking indicator ring - Discord style green glow
    const speakingRing = isSpeaking ? 'ring-4 ring-green-500/70 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : '';

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

            {/* Video layer - always mounted, shown/hidden via CSS to prevent frozen frames */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`
                    absolute inset-0 w-full h-full object-cover
                    ${isLocal ? 'transform scale-x-[-1]' : ''}
                    transition-opacity duration-150
                    ${hasLiveVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
            />

            {/* Avatar fallback - shown when no live video */}
            <div
                className={`absolute inset-0 flex items-center justify-center bg-[#2b2d31] transition-opacity duration-150 ${hasLiveVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className={`rounded-full object-cover border-4 border-[#1e1f22] ${size === 'thumbnail' ? 'w-12 h-12' : size === 'focused' ? 'w-32 h-32' : 'w-24 h-24'}`}
                    />
                ) : (
                    <div className={`
                        flex items-center justify-center rounded-full
                        bg-discord-primary border-4 border-[#1e1f22]
                        ${size === 'thumbnail' ? 'w-12 h-12 text-lg' : size === 'focused' ? 'w-32 h-32 text-5xl' : 'w-24 h-24 text-4xl'}
                        font-bold text-white
                    `}>
                        {initial}
                    </div>
                )}
            </div>

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* Discord-style name pill - bottom left */}
            <div className="absolute bottom-2 left-2">
                <div className="px-2 py-1 rounded bg-black/60 flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate max-w-[120px]">
                        {displayName}
                    </span>
                    {isMuted && (
                        <div className="p-0.5 rounded-full bg-red-500">
                            <MicOff size={10} className="text-white" />
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
