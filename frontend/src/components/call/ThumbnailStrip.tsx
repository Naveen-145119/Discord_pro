/**
 * ThumbnailStrip - Display non-focused participants as small thumbnails
 * Discord-style centered layout at bottom
 */

import { useState } from 'react';
import { ParticipantCard } from './ParticipantCard';
import { MonitorUp } from 'lucide-react';
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
}: ThumbnailStripProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Filter out the focused participant
    const thumbnailParticipants = participants.filter(p => p.odId !== focusedId);
    const thumbnailScreenShares = screenShares.filter(s => s.odId !== focusedId);

    const isEmpty = thumbnailParticipants.length === 0 && thumbnailScreenShares.length === 0;
    if (isEmpty) return null;

    return (
        <div
            className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 z-20"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hide Members label on hover - Discord style */}
            {isHovered && (
                <div className="px-3 py-1 bg-[#1e1f22] rounded-full text-white text-sm font-medium cursor-pointer hover:bg-[#2b2d31] transition-colors">
                    Hide Members
                </div>
            )}

            {/* Thumbnail cards row */}
            <div className="flex items-center justify-center gap-2 px-4">
                {/* Screen shares as thumbnails with LIVE badge */}
                {thumbnailScreenShares.map(share => (
                    <div
                        key={`screen-${share.odId}`}
                        onClick={() => onFocus(share.odId)}
                        className="relative cursor-pointer transition-all hover:scale-105 flex-shrink-0 w-[140px] h-[100px] rounded-lg overflow-hidden bg-[#2b2d31] group"
                    >
                        {/* Video preview */}
                        <video
                            autoPlay
                            muted
                            playsInline
                            ref={el => {
                                if (el) el.srcObject = share.stream;
                            }}
                            className="w-full h-full object-cover"
                        />
                        {/* LIVE badge */}
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-red-600 rounded text-white text-[10px] font-bold">
                            LIVE
                        </div>
                        {/* Name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="flex items-center gap-1 text-white text-xs">
                                <MonitorUp size={10} />
                                <span className="truncate">{share.displayName}</span>
                            </div>
                        </div>
                        {/* Hover border */}
                        <div className="absolute inset-0 border-2 border-transparent group-hover:border-discord-primary rounded-lg transition-colors" />
                    </div>
                ))}

                {/* Participants as thumbnails */}
                {thumbnailParticipants.map(participant => (
                    <div
                        key={participant.odId}
                        onClick={() => onFocus(participant.odId)}
                        className="cursor-pointer transition-all hover:scale-105 flex-shrink-0"
                    >
                        <ParticipantCard
                            odId={participant.odId}
                            displayName={participant.displayName}
                            avatarUrl={participant.avatarUrl}
                            stream={participant.stream ?? null}
                            isMuted={participant.isMuted}
                            isVideoOn={participant.isVideoOn}
                            isSpeaking={participant.isSpeaking}
                            isLocal={participant.odId === 'local'}
                            size="thumbnail"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

