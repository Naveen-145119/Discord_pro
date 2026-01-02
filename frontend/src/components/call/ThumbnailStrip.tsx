/**
 * ThumbnailStrip - Display non-focused participants as small thumbnails
 * 
 * Used in:
 * - Server voice channels with multiple participants
 * - When one stream is focused, others appear here
 */

import { ParticipantCard } from './ParticipantCard';
import { ScreenShareCard } from './ScreenShareCard';
import type { CallParticipant } from '@/lib/webrtc';

export interface ThumbnailStripProps {
    participants: CallParticipant[];
    screenShares: Array<{
        odId: string;
        displayName: string;
        stream: MediaStream;
    }>;
    focusedId: string | null;
    onFocus: (id: string) => void;
    position?: 'top' | 'bottom' | 'right';
}

export function ThumbnailStrip({
    participants,
    screenShares,
    focusedId,
    onFocus,
    position = 'bottom',
}: ThumbnailStripProps) {
    // Filter out the focused participant
    const thumbnailParticipants = participants.filter(p => p.odId !== focusedId);
    const thumbnailScreenShares = screenShares.filter(s => s.odId !== focusedId);

    const isEmpty = thumbnailParticipants.length === 0 && thumbnailScreenShares.length === 0;
    if (isEmpty) return null;

    const positionClasses = {
        top: 'flex-row absolute top-2 left-2 right-2',
        bottom: 'flex-row absolute bottom-2 left-2 right-2',
        right: 'flex-col absolute right-2 top-2 bottom-2',
    };

    return (
        <div className={`${positionClasses[position]} flex gap-2 z-10 overflow-x-auto`}>
            {/* Screen shares as thumbnails */}
            {thumbnailScreenShares.map(share => (
                <div
                    key={`screen-${share.odId}`}
                    onClick={() => onFocus(share.odId)}
                    className="cursor-pointer transition-transform hover:scale-105 flex-shrink-0"
                >
                    <ScreenShareCard
                        stream={share.stream}
                        sharerId={share.odId}
                        sharerName={share.displayName}
                    />
                </div>
            ))}

            {/* Participants as thumbnails */}
            {thumbnailParticipants.map(participant => (
                <div
                    key={participant.odId}
                    onClick={() => onFocus(participant.odId)}
                    className="cursor-pointer transition-transform hover:scale-105 flex-shrink-0"
                >
                    <ParticipantCard
                        odId={participant.odId}
                        displayName={participant.displayName}
                        avatarUrl={participant.avatarUrl}
                        stream={participant.stream ?? null}
                        isMuted={participant.isMuted}
                        isVideoOn={participant.isVideoOn}
                        isSpeaking={participant.isSpeaking}
                        size="thumbnail"
                    />
                </div>
            ))}
        </div>
    );
}
