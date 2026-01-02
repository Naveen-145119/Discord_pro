import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Phone,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Maximize2,
    Clock,
    Volume2
} from 'lucide-react';
import type { User } from '@/types';

interface MiniPlayerProps {
    friend: User;
    remoteStream: MediaStream | null;
    localStream: MediaStream | null;
    isMuted: boolean;
    isVideoOn: boolean;
    callDuration: number;
    onExpand: () => void;
    onEndCall: () => void;
    onToggleMute: () => void;
    onToggleVideo: () => Promise<void>;
}

/**
 * MiniPlayer - Floating draggable call widget
 * Persists in corner while navigating the app
 */
export function MiniPlayer({
    friend,
    remoteStream,
    localStream,
    isMuted,
    isVideoOn,
    callDuration,
    onExpand,
    onEndCall,
    onToggleMute,
    onToggleVideo,
}: MiniPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showControls, setShowControls] = useState(false);
    const constraintsRef = useRef<HTMLDivElement>(null);

    // Format duration as MM:SS
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Get display stream - prefer remote, fallback to local for preview
    const displayStream = remoteStream || localStream;
    const hasVideo = displayStream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

    // Attach video stream
    useEffect(() => {
        if (videoRef.current && displayStream) {
            videoRef.current.srcObject = displayStream;
            videoRef.current.play().catch(() => { });
        }
    }, [displayStream]);

    return (
        <>
            {/* Invisible constraints container for drag bounds */}
            <div
                ref={constraintsRef}
                className="fixed inset-4 pointer-events-none z-[90]"
            />

            {/* Draggable Mini Player */}
            <motion.div
                drag
                dragMomentum={false}
                dragConstraints={constraintsRef}
                initial={{ opacity: 0, scale: 0.8, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed bottom-6 right-6 z-[100] cursor-grab active:cursor-grabbing"
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
            >
                <div className="w-72 bg-[#1e1f22] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                    {/* Video / Avatar Area */}
                    <div className="relative aspect-video bg-black">
                        {hasVideo ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted={!remoteStream}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2b2d31] to-[#1e1f22]">
                                <div className="w-16 h-16 rounded-full bg-discord-primary flex items-center justify-center overflow-hidden">
                                    {friend.avatarUrl ? (
                                        <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl font-bold text-white">
                                            {friend.displayName?.charAt(0) || '?'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Overlay Controls (on hover) */}
                        <motion.div
                            initial={false}
                            animate={{ opacity: showControls ? 1 : 0 }}
                            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"
                        >
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
                                {/* Quick Controls */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={onToggleMute}
                                        className={`p-1.5 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                                            }`}
                                    >
                                        {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                                    </button>
                                    <button
                                        onClick={onToggleVideo}
                                        className={`p-1.5 rounded-full transition-colors ${!isVideoOn ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                                            }`}
                                    >
                                        {isVideoOn ? <Video size={14} /> : <VideoOff size={14} />}
                                    </button>
                                    <button
                                        onClick={onEndCall}
                                        className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                                    >
                                        <Phone size={14} className="rotate-[135deg]" />
                                    </button>
                                </div>

                                {/* Expand Button */}
                                <button
                                    onClick={onExpand}
                                    className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                                    title="Expand"
                                >
                                    <Maximize2 size={14} />
                                </button>
                            </div>
                        </motion.div>

                        {/* Always visible audio indicator */}
                        {remoteStream && (
                            <div className="absolute top-2 right-2 p-1 bg-black/50 rounded">
                                <Volume2 size={12} className="text-green-400 animate-pulse" />
                            </div>
                        )}
                    </div>

                    {/* Info Bar */}
                    <div className="px-3 py-2 flex items-center justify-between bg-[#2b2d31]">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-discord-primary flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {friend.avatarUrl ? (
                                    <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-medium text-white">
                                        {friend.displayName?.charAt(0) || '?'}
                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-medium text-white truncate">
                                {friend.displayName}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={10} />
                            {formatDuration(callDuration)}
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}
