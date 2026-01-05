/**
 * CallContainer - Layout Orchestrator for Multi-Participant Calls
 * 
 * Manages:
 * - Focus/unfocus of participants
 * - Grid vs focused view layouts
 * - Screen share priority
 * - Smooth transitions between states
 */

import { useState, useMemo, useCallback } from 'react';
import { ParticipantCard } from './ParticipantCard';
import { ScreenShareCard } from './ScreenShareCard';
import { ThumbnailStrip } from './ThumbnailStrip';
import { MonitorUp } from 'lucide-react';
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
        const shares: Array<{ odId: string; displayName: string; stream: MediaStream; isLocal: boolean }> = [];

        // Local screen share
        if (isLocalScreenSharing && localScreenStream) {
            shares.push({
                odId: 'local-screen',
                displayName: `${localDisplayName}'s screen`,
                stream: localScreenStream,
                isLocal: true,
            });
        }

        // Remote screen shares - use screenStream
        participants.forEach(p => {
            console.log('[CallContainer] Participant:', p.displayName,
                'isScreenSharing:', p.isScreenSharing,
                'hasScreenStream:', !!p.screenStream,
                'screenStream tracks:', p.screenStream?.getTracks().length ?? 0);

            if (p.isScreenSharing && p.screenStream) {
                console.log('[CallContainer] ✅ Adding remote screen share card for:', p.displayName);
                shares.push({
                    odId: `${p.odId}-screen`,
                    displayName: `${p.displayName}'s screen`,
                    stream: p.screenStream,
                    isLocal: false,
                });
            }
        });

        console.log('[CallContainer] Total screen shares:', shares.length, shares.map(s => s.displayName));
        return shares;
    }, [isLocalScreenSharing, localScreenStream, localDisplayName, participants]);

    // NOTE: Removed auto-focus - grid view is the default per Discord behavior
    // User must click "Watch Stream" to focus a screen share

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
            cameraStream: localStream ?? undefined,
            stream: localStream ?? undefined, // backward compat
        };
        return [local, ...participants];
    }, [localDisplayName, localAvatarUrl, isLocalMuted, isLocalVideoOn, isLocalSpeaking, isLocalScreenSharing, localStream, participants]);

    // Determine what's focused
    const focusedScreenShare = screenShares.find(s => s.odId === focusedId);
    const focusedParticipant = !focusedScreenShare ? allParticipants.find(p => p.odId === focusedId) : null;
    const isGridView = !focusedId;

    // Number of cards in grid (participants + screen shares)
    const gridItemCount = allParticipants.length + screenShares.length;

    // Grid layout for multiple participants - Discord style
    const getGridCols = (count: number) => {
        if (count <= 1) return 'grid-cols-1';
        if (count <= 2) return 'grid-cols-2';
        if (count <= 4) return 'grid-cols-2';
        if (count <= 6) return 'grid-cols-3';
        return 'grid-cols-4';
    };

    return (
        <div className="relative w-full h-full bg-[#1e1f22] overflow-hidden">
            {/* Focused View - Click anywhere to return to grid */}
            {focusedScreenShare && (
                <div
                    className="w-full h-full flex items-center justify-center p-4 pb-32 cursor-pointer"
                    onClick={() => setFocusedId(null)}
                >
                    <ScreenShareCard
                        stream={focusedScreenShare.stream}
                        sharerId={focusedScreenShare.odId}
                        sharerName={focusedScreenShare.displayName}
                        isFocused
                        isLocal={focusedScreenShare.isLocal}
                        onStopSharing={focusedScreenShare.isLocal ? onStopScreenShare : undefined}
                    />
                </div>
            )}

            {focusedParticipant && !focusedScreenShare && (
                <div className="w-full h-full flex items-center justify-center p-4 pb-32">
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

            {/* Grid View - Discord Style */}
            {isGridView && (
                <div className={`grid ${getGridCols(gridItemCount)} gap-3 p-4 h-full place-items-center`}>
                    {/* Screen shares in grid with "Watch Stream" button */}
                    {screenShares.map(share => (
                        <div
                            key={share.odId}
                            onClick={() => handleFocus(share.odId)}
                            className="relative cursor-pointer w-full max-w-[400px] aspect-video rounded-xl overflow-hidden bg-[#2b2d31] group"
                        >
                            {/* Video preview */}
                            <video
                                autoPlay
                                muted
                                playsInline
                                ref={el => {
                                    if (el) el.srcObject = share.stream;
                                }}
                                className="w-full h-full object-contain"
                            />
                            {/* Name overlay at bottom */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                <div className="flex items-center gap-2 text-white text-sm">
                                    <MonitorUp size={14} className="text-green-400" />
                                    <span className="truncate">{share.displayName.replace("'s screen", "")}</span>
                                </div>
                            </div>
                            {/* Watch Stream button - centered */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <button className="px-4 py-2 bg-[#2b2d31] text-white font-medium rounded-md hover:bg-[#3b3d44] transition-colors shadow-lg">
                                    Watch Stream
                                </button>
                            </div>
                            {/* Hover border */}
                            <div className="absolute inset-0 border-2 border-transparent group-hover:border-discord-primary rounded-xl transition-colors" />
                        </div>
                    ))}

                    {/* Participant cards */}
                    {allParticipants.map(participant => (
                        <div
                            key={participant.odId}
                            onClick={() => handleFocus(participant.odId)}
                            className="cursor-pointer w-full max-w-[400px]"
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

