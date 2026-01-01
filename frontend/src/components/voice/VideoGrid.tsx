/**
 * VideoGrid Component
 * Displays video feeds in responsive grid layout
 */
import { useRef, useEffect } from 'react';
import type { CallParticipant } from '@/lib/webrtc';
import { MicOff, MonitorUp } from 'lucide-react';

interface VideoGridProps {
    localStream: MediaStream | null;
    participants: Map<string, CallParticipant>;
    localDisplayName: string;
    isLocalMuted: boolean;
    isLocalVideoOn: boolean;
    isLocalScreenSharing: boolean;
}

export function VideoGrid({
    localStream,
    participants,
    localDisplayName,
    isLocalMuted,
    isLocalVideoOn,
    isLocalScreenSharing,
}: VideoGridProps) {
    const totalParticipants = participants.size + 1; // +1 for self

    // Calculate grid layout
    const getGridClass = () => {
        if (totalParticipants === 1) return 'grid-cols-1';
        if (totalParticipants === 2) return 'grid-cols-2';
        if (totalParticipants <= 4) return 'grid-cols-2 grid-rows-2';
        if (totalParticipants <= 6) return 'grid-cols-3 grid-rows-2';
        return 'grid-cols-3 grid-rows-3';
    };

    return (
        <div className={`grid ${getGridClass()} gap-2 p-4 h-full bg-background-primary`}>
            {/* Local video */}
            <VideoTile
                stream={localStream}
                displayName={localDisplayName}
                isMuted={isLocalMuted}
                isVideoOn={isLocalVideoOn}
                isScreenSharing={isLocalScreenSharing}
                isSelf
            />

            {/* Remote videos */}
            {Array.from(participants.values()).map((participant) => (
                <VideoTile
                    key={participant.odId}
                    stream={participant.stream ?? null}
                    displayName={participant.displayName}
                    isMuted={participant.isMuted}
                    isVideoOn={participant.isVideoOn}
                    isScreenSharing={participant.isScreenSharing}
                />
            ))}
        </div>
    );
}

// Video tile sub-component
function VideoTile({
    stream,
    displayName,
    isMuted,
    isVideoOn: _, // Unused but required by type
    isScreenSharing,
    isSelf = false,
}: {
    stream: MediaStream | null;
    displayName: string;
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSelf?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Update video element when stream changes
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const hasVideo = stream?.getVideoTracks().some(t => t.enabled);

    return (
        <div className="relative rounded-lg overflow-hidden bg-background-secondary aspect-video">
            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isSelf} // Mute self to prevent echo
                    className="w-full h-full object-cover"
                />
            ) : (
                // Avatar placeholder when no video
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-discord-primary flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                </div>
            )}

            {/* Overlay with name and status */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                        {displayName}
                        {isSelf && ' (You)'}
                    </span>

                    <div className="flex items-center gap-1 ml-auto">
                        {isScreenSharing && (
                            <MonitorUp size={14} className="text-green-400" />
                        )}
                        {isMuted && (
                            <MicOff size={14} className="text-red-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Self indicator */}
            {isSelf && (
                <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-xs bg-black/50 rounded text-white">
                        You
                    </span>
                </div>
            )}
        </div>
    );
}
