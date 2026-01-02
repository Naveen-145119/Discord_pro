/**
 * CallContainer - Layout Orchestrator for Multi-Participant Calls
 * 
 * Manages:
 * - Focus/unfocus of participants
 * - Grid vs focused view layouts
 * - Screen share priority
 * - Smooth transitions between states
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ParticipantCard } from './ParticipantCard';
import { ScreenShareCard } from './ScreenShareCard';
import { ThumbnailStrip } from './ThumbnailStrip';
import type { CallParticipant } from '@/lib/webrtc';

export interface CallContainerProps {
    // Local user
    localStream: MediaStream | null;
    localDisplayName: string;
    localAvatarUrl?: string;
    isLocalMuted: boolean;
    isLocalVideoOn: boolean;
    isLocalSpeaking: boolean;
    isLocalScreenSharing: boolean;
    localScreenStream?: MediaStream | null;

    // Remote participants
    participants: CallParticipant[];

    // Callbacks
    onStopScreenShare?: () => void;
}

export function CallContainer({
    localStream,
    localDisplayName,
    localAvatarUrl,
    isLocalMuted,
    isLocalVideoOn,
    isLocalSpeaking,
    isLocalScreenSharing,
    localScreenStream,
    participants,
    onStopScreenShare,
}: CallContainerProps) {
    const [focusedId, setFocusedId] = useState<string | null>(null);

    // Collect all screen shares
    const screenShares = useMemo(() => {
        const shares: Array<{ odId: string; displayName: string; stream: MediaStream }> = [];

        // Local screen share
        if (isLocalScreenSharing && localScreenStream) {
            shares.push({
                odId: 'local-screen',
                displayName: `${localDisplayName}'s screen`,
                stream: localScreenStream,
            });
        }

        // Remote screen shares
        participants.forEach(p => {
            if (p.isScreenSharing && p.stream) {
                shares.push({
                    odId: `${p.odId}-screen`,
                    displayName: `${p.displayName}'s screen`,
                    stream: p.stream,
                });
            }
        });

        return shares;
    }, [isLocalScreenSharing, localScreenStream, localDisplayName, participants]);

    // Auto-focus new screen shares
    useEffect(() => {
        if (screenShares.length > 0 && !focusedId) {
            setFocusedId(screenShares[0].odId);
        }
    }, [screenShares, focusedId]);

    const handleFocus = useCallback((id: string) => {
        setFocusedId(prev => prev === id ? null : id);
    }, []);

    // All participants including local
    const allParticipants = useMemo(() => {
        const local: CallParticipant = {
            odId: 'local',
            displayName: localDisplayName,
            avatarUrl: localAvatarUrl,
            isMuted: isLocalMuted,
            isDeafened: false,
            isVideoOn: isLocalVideoOn,
            isScreenSharing: isLocalScreenSharing,
            isSpeaking: isLocalSpeaking,
            stream: localStream ?? undefined,
        };
        return [local, ...participants];
    }, [localDisplayName, localAvatarUrl, isLocalMuted, isLocalVideoOn, isLocalSpeaking, isLocalScreenSharing, localStream, participants]);

    // Determine what's focused
    const focusedScreenShare = screenShares.find(s => s.odId === focusedId);
    const focusedParticipant = !focusedScreenShare ? allParticipants.find(p => p.odId === focusedId) : null;
    const isGridView = !focusedId;

    // Grid layout for multiple participants
    const getGridCols = (count: number) => {
        if (count <= 1) return 'grid-cols-1';
        if (count <= 2) return 'grid-cols-2';
        if (count <= 4) return 'grid-cols-2';
        if (count <= 9) return 'grid-cols-3';
        return 'grid-cols-4';
    };

    return (
        <div className="relative w-full h-full bg-[#1e1f22] overflow-hidden">
            {/* Focused View */}
            {focusedScreenShare && (
                <div className="w-full h-full flex items-center justify-center">
                    <ScreenShareCard
                        stream={focusedScreenShare.stream}
                        sharerId={focusedScreenShare.odId}
                        sharerName={focusedScreenShare.displayName}
                        isFocused
                        isLocal={focusedScreenShare.odId === 'local-screen'}
                        onStopSharing={focusedScreenShare.odId === 'local-screen' ? onStopScreenShare : undefined}
                    />
                </div>
            )}

            {focusedParticipant && !focusedScreenShare && (
                <div className="w-full h-full flex items-center justify-center p-4">
                    <ParticipantCard
                        odId={focusedParticipant.odId}
                        displayName={focusedParticipant.displayName}
                        avatarUrl={focusedParticipant.avatarUrl}
                        stream={focusedParticipant.stream ?? null}
                        isMuted={focusedParticipant.isMuted}
                        isVideoOn={focusedParticipant.isVideoOn}
                        isSpeaking={focusedParticipant.isSpeaking}
                        isLocal={focusedParticipant.odId === 'local'}
                        size="focused"
                        isFocused
                    />
                </div>
            )}

            {/* Grid View */}
            {isGridView && (
                <div className={`grid ${getGridCols(allParticipants.length)} gap-2 p-4 h-full`}>
                    {allParticipants.map(participant => (
                        <div
                            key={participant.odId}
                            onClick={() => handleFocus(participant.odId)}
                            className="cursor-pointer"
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
                                size="medium"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Thumbnail strip when focused */}
            {!isGridView && (
                <ThumbnailStrip
                    participants={allParticipants}
                    screenShares={screenShares}
                    focusedId={focusedId}
                    onFocus={handleFocus}
                    position="bottom"
                />
            )}
        </div>
    );
}
