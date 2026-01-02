/**
 * ParticipantCard - A specialized stream card for user cameras/avatars
 * Uses composition - wraps StreamCard with participant-specific defaults.
 */

import { StreamCard } from './StreamCard';
import type { StreamType } from './StreamCard';

export interface ParticipantCardProps {
    odId: string;
    displayName: string;
    avatarUrl?: string;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOn: boolean;
    isDeafened?: boolean;
    isSpeaking?: boolean;
    isLocal?: boolean;
    isFocused?: boolean;
    size?: 'thumbnail' | 'medium' | 'focused';
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export function ParticipantCard({
    odId,
    displayName,
    avatarUrl,
    stream,
    isMuted,
    isVideoOn,
    isDeafened = false,
    isSpeaking = false,
    isLocal = false,
    isFocused = false,
    size = 'medium',
    onClick,
    onDoubleClick,
}: ParticipantCardProps) {
    const streamType: StreamType = isVideoOn ? 'camera' : 'audio-only';

    return (
        <StreamCard
            stream={stream}
            displayName={displayName}
            odId={odId}
            streamType={streamType}
            isMuted={isMuted || isDeafened}
            isSpeaking={isSpeaking}
            isLocal={isLocal}
            isFocused={isFocused}
            size={size}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            avatarUrl={avatarUrl}
        />
    );
}
