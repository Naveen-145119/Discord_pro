import { useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuthStore } from '@/stores/authStore';
import { CallControls } from './CallControls';
import { Mic, MicOff, HeadphoneOff, Video, MonitorUp } from 'lucide-react';

interface VoiceChannelProps {
    channelId: string;
    channelName: string;
}

export function VoiceChannel({ channelId, channelName }: VoiceChannelProps) {
    const { user } = useAuthStore();

    const {
        connectionState,
        participants,
        isMuted,
        isDeafened,
        isVideoOn,
        isScreenSharing,
        isSpeaking,
        error,
        joinChannel,
        leaveChannel,
        toggleMute,
        toggleDeafen,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
    } = useWebRTC({
        channelId,
        userId: user?.$id ?? '',
        displayName: user?.displayName ?? 'Unknown',
    });

    useEffect(() => {
        if (user && connectionState === 'disconnected') {
            joinChannel();
        }

        return () => {
            leaveChannel();
        };
    }, [user, channelId]);

    if (!user) return null;

    return (
        <div className="flex flex-col h-full bg-background-primary">
            <div className="flex items-center justify-between p-4 border-b border-background-tertiary">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-status-online' :
                        connectionState === 'connecting' ? 'bg-status-idle animate-pulse' :
                            'bg-status-offline'
                        }`} />
                    <h2 className="text-lg font-semibold text-text-heading">
                        {channelName}
                    </h2>
                </div>
                <span className="text-sm text-text-muted">
                    {participants.size + 1} connected
                </span>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border-b border-red-500/20">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <ParticipantItem
                    displayName={user.displayName}
                    isMuted={isMuted}
                    isDeafened={isDeafened}
                    isVideoOn={isVideoOn}
                    isScreenSharing={isScreenSharing}
                    isSpeaking={isSpeaking}
                    isSelf
                />

                {Array.from(participants.values()).map((participant) => (
                    <ParticipantItem
                        key={participant.odId}
                        displayName={participant.displayName}
                        isMuted={participant.isMuted}
                        isDeafened={participant.isDeafened}
                        isVideoOn={participant.isVideoOn}
                        isScreenSharing={participant.isScreenSharing}
                        isSpeaking={participant.isSpeaking}
                    />
                ))}
            </div>

            <CallControls
                isMuted={isMuted}
                isDeafened={isDeafened}
                isVideoOn={isVideoOn}
                isScreenSharing={isScreenSharing}
                onToggleMute={toggleMute}
                onToggleDeafen={toggleDeafen}
                onToggleVideo={toggleVideo}
                onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
                onDisconnect={leaveChannel}
            />
        </div>
    );
}

function ParticipantItem({
    displayName,
    isMuted,
    isDeafened,
    isVideoOn,
    isScreenSharing,
    isSpeaking,
    isSelf = false,
}: {
    displayName: string;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    isSelf?: boolean;
}) {
    return (
        <div className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isSpeaking ? 'bg-discord-primary/20 ring-2 ring-discord-primary' : 'bg-background-secondary'
            }`}>
            <div className="relative">
                <div className={`w-10 h-10 rounded-full bg-discord-primary flex items-center justify-center ${isSpeaking ? 'ring-2 ring-green-500' : ''
                    }`}>
                    <span className="text-sm font-medium text-white">
                        {displayName.charAt(0).toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-normal truncate">
                    {displayName}
                    {isSelf && <span className="text-text-muted ml-1">(You)</span>}
                </p>
            </div>

            <div className="flex items-center gap-1">
                {isScreenSharing && (
                    <MonitorUp size={16} className="text-green-400" />
                )}
                {isVideoOn && (
                    <Video size={16} className="text-text-muted" />
                )}
                {isDeafened ? (
                    <HeadphoneOff size={16} className="text-red-400" />
                ) : isMuted ? (
                    <MicOff size={16} className="text-red-400" />
                ) : (
                    <Mic size={16} className={isSpeaking ? 'text-green-400' : 'text-text-muted'} />
                )}
            </div>
        </div>
    );
}
