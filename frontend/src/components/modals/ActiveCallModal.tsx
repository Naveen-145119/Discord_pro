import { useRef, useEffect, useState, useMemo } from 'react';
import {
    Phone,
    Video,
    MonitorUp,
    Mic,
    MicOff,
    VideoOff,
    Volume2,
    VolumeX,
    Maximize2,
    Minimize2,
    Signal,
    Clock,
    MessageSquare
} from 'lucide-react';
import type { ActiveCall } from '@/hooks/useCall';
import type { User } from '@/types';
import type { CallParticipant } from '@/lib/webrtc';
import { CallContainer, DeviceSettingsPopover, InCallChatSection } from '@/components/call';
import { ProfilePopover } from '@/components/modals/ProfilePopover';
import { useMediaStore } from '@/stores/mediaStore';

interface ActiveCallModalProps {
    call: ActiveCall;
    friend: User;
    currentUserId: string;
    localDisplayName: string;
    localAvatarUrl?: string;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    localStream: MediaStream | null;
    screenStream: MediaStream | null;
    remoteStream: MediaStream | null;
    remoteStreamVersion: number;
    participants: Map<string, CallParticipant>;
    remoteParticipant: CallParticipant | null;
    isCalling: boolean;
    callDuration: number;
    onEndCall: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleVideo: () => Promise<void>;
    onToggleScreenShare: () => Promise<void>;
    onMinimize?: () => void;
}

export function ActiveCallModal({
    call,
    friend,
    currentUserId,
    localDisplayName,
    localAvatarUrl,
    isMuted,
    isDeafened: _isDeafened,
    isVideoOn,
    isScreenSharing,
    isSpeaking,
    localStream,
    screenStream,
    remoteStream,
    remoteStreamVersion,
    participants,
    remoteParticipant: _remoteParticipant,
    isCalling,
    callDuration,
    onEndCall,
    onToggleMute,
    onToggleDeafen: _onToggleDeafen,
    onToggleVideo,
    onToggleScreenShare,
    onMinimize,
}: ActiveCallModalProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { outputVolume: volume, setOutputVolume: setVolume } = useMediaStore();
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [connectionQuality] = useState<'good' | 'medium' | 'poor'>('good');

    // Chat state
    const [showChat, setShowChat] = useState(false);
    const channelId = call.channelId;

    // Profile popover state
    const [selectedProfile, setSelectedProfile] = useState<{
        user: { displayName: string; avatarUrl?: string | null; username?: string; status?: string };
        isCurrentUser: boolean;
    } | null>(null);

    // Convert participants Map to Array for CallContainer
    const participantsArray = useMemo(() => Array.from(participants.values()), [participants]);

    // Format duration as MM:SS or HH:MM:SS
    const formatDuration = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle local stream with dynamic track changes
    useEffect(() => {
        if (!localStream) return;

        const updateLocalVideo = () => {
            if (localVideoRef.current) {
                const videoTracks = localStream.getVideoTracks();
                // Only show video if there are live video tracks
                if (videoTracks.some(t => t.readyState === 'live')) {
                    localVideoRef.current.srcObject = null;
                    localVideoRef.current.srcObject = localStream;
                    localVideoRef.current.play().catch(() => { });
                }
            }
        };

        updateLocalVideo();

        // Listen for track additions/removals
        const handleTrackChange = () => {
            updateLocalVideo();
        };

        localStream.addEventListener('addtrack', handleTrackChange);
        localStream.addEventListener('removetrack', handleTrackChange);

        return () => {
            localStream.removeEventListener('addtrack', handleTrackChange);
            localStream.removeEventListener('removetrack', handleTrackChange);
        };
    }, [localStream]);

    // Handle remote stream video only (audio is handled by CallAudioManager)
    useEffect(() => {
        if (!remoteStream || !remoteVideoRef.current) return;

        const videoTracks = remoteStream.getVideoTracks();
        const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');

        if (liveVideoTracks.length > 0) {
            // CRITICAL: Clear srcObject before setting new stream to ensure browser resets video element
            remoteVideoRef.current.srcObject = null;

            // Small delay to ensure browser processes the reset
            setTimeout(() => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;

                    // Retry play with exponential backoff if blocked
                    const attemptPlay = (attempt = 1) => {
                        remoteVideoRef.current?.play().catch(() => {
                            if (attempt < 3) {
                                setTimeout(() => attemptPlay(attempt + 1), 100 * attempt);
                            }
                        });
                    };
                    attemptPlay();
                }
            }, 10);
        } else {
            // No live video tracks - clear the video element to avoid showing frozen frame
            remoteVideoRef.current.srcObject = null;
        }
    }, [remoteStream, remoteStreamVersion]);

    // Fullscreen toggle
    const toggleFullscreen = async () => {
        if (!containerRef.current) return;

        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'idle': return 'bg-yellow-500';
            case 'dnd': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getQualityColor = () => {
        switch (connectionQuality) {
            case 'good': return 'text-green-500';
            case 'medium': return 'text-yellow-500';
            case 'poor': return 'text-red-500';
        }
    };

    const hasRemoteVideo = remoteStream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

    // Detect if remote video is likely a screen share (check video track settings)
    const isRemoteScreenShare = hasRemoteVideo && remoteStream?.getVideoTracks().some(t => {
        const settings = t.getSettings();
        // Screen shares typically have larger dimensions and different display surface
        return (settings.width && settings.width >= 1280) ||
            (settings.displaySurface === 'monitor' || settings.displaySurface === 'window');
    });

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-[#1e1f22] flex flex-col z-[100]"
        >
            {/* Audio handled by CallAudioManager in CallProvider */}

            {/* Top Bar - Hide in fullscreen with screen share for immersive view */}
            <div className={`p-4 flex items-center justify-between bg-[#2b2d31] z-20 ${isFullscreen && isRemoteScreenShare ? 'absolute top-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-black/80 to-transparent' : ''
                }`}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-discord-primary flex items-center justify-center overflow-hidden">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg font-medium text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${getStatusColor(friend.status)}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{friend.displayName}</h3>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                            {isCalling ? (
                                <span className="animate-pulse">Ringing...</span>
                            ) : (
                                <>
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {formatDuration(callDuration)}
                                    </span>
                                    <span className="text-gray-600">•</span>
                                    <span className={`flex items-center gap-1 ${getQualityColor()}`}>
                                        <Signal size={12} />
                                        {connectionQuality === 'good' ? 'Good' : connectionQuality === 'medium' ? 'Fair' : 'Poor'}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Volume Control */}
                    <div className="relative">
                        <button
                            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title={`Volume: ${volume}%`}
                        >
                            {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>

                        {showVolumeSlider && (
                            <div className="absolute top-full right-0 mt-2 p-3 bg-[#111214] rounded-lg shadow-xl border border-gray-700 w-48 z-50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-400">Output Volume</span>
                                    <span className="text-xs font-medium text-white">{volume}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="200"
                                    value={volume}
                                    onChange={(e) => setVolume(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>0%</span>
                                    <span>100%</span>
                                    <span>200%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>

                    {/* Minimize */}
                    <button
                        onClick={onMinimize}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Minimize to PiP"
                    >
                        <Minimize2 size={20} />
                    </button>
                </div>
            </div>

            {/* Call Area with embedded control bar - shrinks when chat is visible */}
            <div className={`${showChat ? 'flex-1' : 'flex-1'} relative flex flex-col bg-[#1e1f22] overflow-hidden`}>
                {/* Video/Avatars Area */}
                <div className={`flex-1 flex items-center justify-center ${isFullscreen && isRemoteScreenShare ? 'p-0' : 'p-4'}`}>
                    <CallContainer
                        localStream={localStream}
                        localDisplayName={localDisplayName}
                        localAvatarUrl={localAvatarUrl}
                        isLocalMuted={isMuted}
                        isLocalVideoOn={isVideoOn}
                        isLocalSpeaking={isSpeaking}
                        isLocalScreenSharing={isScreenSharing}
                        localScreenStream={screenStream}
                        participants={participantsArray}
                        onStopScreenShare={onToggleScreenShare}
                        onParticipantClick={(participant) => setSelectedProfile({
                            user: {
                                displayName: participant.displayName,
                                avatarUrl: participant.avatarUrl,
                                status: participant.isLocal ? 'online' : (friend.status || 'offline')
                            },
                            isCurrentUser: participant.isLocal
                        })}
                    />

                    {/* Screen Share Indicator */}
                    {isScreenSharing && (
                        <div className="absolute top-4 left-4 px-3 py-2 bg-green-500/90 rounded-lg flex items-center gap-2 text-white text-sm">
                            <MonitorUp size={16} />
                            You are sharing your screen
                        </div>
                    )}
                </div>

                {/* Control Bar - Always inside call area, floating at bottom */}
                <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-[#1e1f22]/90 backdrop-blur-sm rounded-lg ${isFullscreen && isRemoteScreenShare ? 'opacity-0 hover:opacity-100 transition-opacity duration-300' : ''}`}>
                    <div className="flex items-center gap-2">
                        {/* Mute with dropdown indicator */}
                        <div className="relative group">
                            <button
                                onClick={onToggleMute}
                                className={`p-3 rounded-full transition-all hover:scale-105 ${isMuted
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                                    }`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>
                            <div className="absolute -right-0.5 -bottom-0.5 w-3 h-3 bg-[#3b3d44] rounded-full flex items-center justify-center text-white text-[6px] group-hover:bg-[#4b4d54]">
                                ▼
                            </div>
                        </div>

                        {/* Video with dropdown indicator */}
                        <div className="relative group">
                            <button
                                onClick={onToggleVideo}
                                className={`p-3 rounded-full transition-all hover:scale-105 ${isVideoOn
                                    ? 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                                    : 'bg-red-500 text-white hover:bg-red-600'
                                    }`}
                                title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
                            >
                                {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>
                            <div className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[6px] ${isVideoOn ? 'bg-[#4b4d54]' : 'bg-red-600'}`}>
                                ▼
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-8 bg-[#4b4d54] mx-1" />

                        {/* Chat Toggle */}
                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={`p-3 rounded-full transition-all hover:scale-105 ${showChat
                                ? 'bg-white/20 text-white'
                                : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                                }`}
                            title={showChat ? 'Hide Chat' : 'Show Chat'}
                        >
                            <MessageSquare size={20} />
                        </button>

                        {/* Device Settings */}
                        <DeviceSettingsPopover />

                        {/* Screen Share */}
                        <button
                            onClick={onToggleScreenShare}
                            className={`p-3 rounded-full transition-all hover:scale-105 ${isScreenSharing
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                                }`}
                            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                        >
                            <MonitorUp size={20} />
                        </button>

                        {/* End Call */}
                        <button
                            onClick={onEndCall}
                            className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all hover:scale-105"
                            title="End Call"
                        >
                            <Phone size={20} className="rotate-[135deg]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat Section - Takes fixed height when visible */}
            {showChat && channelId && (
                <div className="h-[280px] flex-shrink-0">
                    <InCallChatSection
                        channelId={channelId}
                        currentUserId={currentUserId}
                        currentUser={{ displayName: localDisplayName, avatarUrl: localAvatarUrl }}
                        friend={friend}
                        onClose={() => setShowChat(false)}
                    />
                </div>
            )}
            {/* Profile Popover */}
            {selectedProfile && (
                <ProfilePopover
                    user={selectedProfile.user}
                    isOpen={!!selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                    isCurrentUser={selectedProfile.isCurrentUser}
                    onMessage={() => {
                        setShowChat(true);
                        setSelectedProfile(null);
                    }}
                />
            )}
        </div>
    );
}
