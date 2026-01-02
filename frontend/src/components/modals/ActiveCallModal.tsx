import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
    Headphones,
    HeadphoneOff
} from 'lucide-react';
import type { ActiveCall } from '@/hooks/useCall';
import type { User } from '@/types';
import type { CallParticipant } from '@/lib/webrtc';
import { CallContainer, DeviceSettingsPopover } from '@/components/call';

interface ActiveCallModalProps {
    call: ActiveCall;
    friend: User;
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
    onEndCall: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleVideo: () => Promise<void>;
    onToggleScreenShare: () => Promise<void>;
    onMinimize?: () => void;
}

export function ActiveCallModal({
    call: _call,
    friend,
    isMuted,
    isDeafened,
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
    onEndCall,
    onToggleMute,
    onToggleDeafen,
    onToggleVideo,
    onToggleScreenShare,
    onMinimize,
}: ActiveCallModalProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    // For Chrome WebRTC audio bug workaround - need a muted element
    const hiddenAudioRef = useRef<HTMLAudioElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const callStartTimeRef = useRef<number | null>(null);

    const [audioPlaybackFailed, setAudioPlaybackFailed] = useState(false);
    const [volume, setVolume] = useState(100); // 0-200%
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [connectionQuality] = useState<'good' | 'medium' | 'poor'>('good');

    // Convert participants Map to Array for CallContainer
    const participantsArray = useMemo(() => Array.from(participants.values()), [participants]);

    // Call duration timer
    useEffect(() => {
        if (remoteStream && !isCalling) {
            if (!callStartTimeRef.current) {
                callStartTimeRef.current = Date.now();
            }

            const interval = setInterval(() => {
                if (callStartTimeRef.current) {
                    setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [remoteStream, isCalling]);

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

    // Track if audio context has been set up for current stream
    const audioSetupForStreamRef = useRef<string | null>(null);

    /**
     * FIXED: WebRTC Audio with Volume Control
     * 
     * Chrome has a bug where WebRTC remote streams need special handling:
     * 1. Attach stream to a MUTED audio element (workaround for Chrome bug)
     * 2. Use createMediaStreamSource (NOT createMediaElementSource) 
     * 3. Route through GainNode for volume control
     * 4. Connect to AudioContext.destination for playback
     * 
     * This approach gives us:
     * - Working audio in Chrome
     * - Volume control (0-200%)
     * - Audio level monitoring
     */
    const setupAudioWithGain = useCallback(async (stream: MediaStream, initialVolume: number) => {
        // Create unique ID for this stream
        const streamId = stream.id + stream.getAudioTracks().map(t => t.id).join('');

        // Skip if already set up for this exact stream
        if (audioSetupForStreamRef.current === streamId && audioContextRef.current) {
            console.log('[ActiveCallModal] Audio already set up for this stream, updating volume only');
            if (gainNodeRef.current) {
                gainNodeRef.current.gain.value = initialVolume / 100;
            }
            return;
        }

        console.log('[ActiveCallModal] Setting up audio for stream:', streamId.substring(0, 20));

        try {
            // Cleanup previous audio context
            if (audioContextRef.current) {
                try {
                    sourceNodeRef.current?.disconnect();
                    gainNodeRef.current?.disconnect();
                    await audioContextRef.current.close();
                } catch (e) {
                    console.log('[ActiveCallModal] Error cleaning up previous audio context:', e);
                }
                audioContextRef.current = null;
                gainNodeRef.current = null;
                sourceNodeRef.current = null;
            }

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[ActiveCallModal] No audio tracks in stream');
                return;
            }

            // CHROME WORKAROUND: Attach stream to a MUTED audio element
            // This "activates" the stream in Chrome without playing it directly
            const hiddenAudio = hiddenAudioRef.current;
            if (hiddenAudio) {
                hiddenAudio.srcObject = stream;
                hiddenAudio.muted = true;
                try {
                    await hiddenAudio.play();
                    console.log('[ActiveCallModal] Hidden muted audio element playing (Chrome workaround)');
                } catch (e) {
                    console.log('[ActiveCallModal] Hidden audio play failed (may be fine):', e);
                }
            }

            // Create AudioContext for volume control
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            // Resume context if suspended (autoplay policy)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
                console.log('[ActiveCallModal] AudioContext resumed');
            }

            // Create source from the MediaStream directly (NOT from an element)
            // We create a new stream with just the audio track for cleaner handling
            const audioOnlyStream = new MediaStream(audioTracks);
            const source = audioContext.createMediaStreamSource(audioOnlyStream);
            sourceNodeRef.current = source;

            // Create gain node for volume control (allows boost beyond 100%)
            const gainNode = audioContext.createGain();
            gainNodeRef.current = gainNode;
            gainNode.gain.value = initialVolume / 100;

            // Connect: source -> gain -> destination (speakers)
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            audioSetupForStreamRef.current = streamId;

            console.log('[ActiveCallModal] ✅ Audio pipeline set up: MediaStreamSource -> GainNode -> Destination');
            console.log('[ActiveCallModal] Initial volume:', initialVolume, '% (gain:', gainNode.gain.value, ')');

            setAudioPlaybackFailed(false);

            // Monitor audio levels to verify audio is flowing
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser); // Also connect source to analyser (parallel)

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                if (audioContext.state === 'closed') {
                    clearInterval(checkInterval);
                    return;
                }
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const peak = Math.max(...dataArray);
                console.log('[ActiveCallModal] Audio level - avg:', average.toFixed(2), 'peak:', peak, 'gain:', gainNode.gain.value.toFixed(2));
                checkCount++;
                if (checkCount >= 10) {
                    clearInterval(checkInterval);
                }
            }, 1000);

            return () => clearInterval(checkInterval);
        } catch (err) {
            console.error('[ActiveCallModal] Failed to setup audio:', err);
            setAudioPlaybackFailed(true);
        }
    }, []);

    // Update gain when volume changes
    useEffect(() => {
        if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
            // Apply volume with smooth transition to avoid clicks
            const currentTime = audioContextRef.current.currentTime;
            gainNodeRef.current.gain.cancelScheduledValues(currentTime);
            gainNodeRef.current.gain.setTargetAtTime(volume / 100, currentTime, 0.05);
            console.log('[ActiveCallModal] Volume changed to:', volume, '% (gain target:', (volume / 100).toFixed(2), ')');
        }
    }, [volume]);

    // Fix 5: Handle local stream with dynamic track changes (e.g., video being added later)
    useEffect(() => {
        if (!localStream) return;

        const updateLocalVideo = () => {
            if (localVideoRef.current) {
                const videoTracks = localStream.getVideoTracks();
                console.log('[ActiveCallModal] Local stream video tracks:', videoTracks.length,
                    videoTracks.map(t => `${t.id.substring(0, 8)}:${t.enabled}:${t.readyState}`).join(', '));

                // Only show video if there are live video tracks
                if (videoTracks.some(t => t.readyState === 'live')) {
                    // Reset srcObject to force re-bind
                    localVideoRef.current.srcObject = null;
                    localVideoRef.current.srcObject = localStream;
                    localVideoRef.current.play().catch(() => {
                        // Autoplay might be blocked, that's fine for local preview
                    });
                }
            }
        };

        // Initial update
        updateLocalVideo();

        // Listen for track additions/removals
        const handleTrackChange = () => {
            console.log('[ActiveCallModal] Local stream track changed');
            updateLocalVideo();
        };

        localStream.addEventListener('addtrack', handleTrackChange);
        localStream.addEventListener('removetrack', handleTrackChange);

        return () => {
            localStream.removeEventListener('addtrack', handleTrackChange);
            localStream.removeEventListener('removetrack', handleTrackChange);
        };
    }, [localStream]);

    // Handle remote stream with gain-controlled audio
    useEffect(() => {
        if (!remoteStream) {
            console.log('[ActiveCallModal] No remote stream yet');
            return;
        }

        const audioTracks = remoteStream.getAudioTracks();
        const videoTracks = remoteStream.getVideoTracks();
        console.log('[ActiveCallModal] Remote stream received (version:', remoteStreamVersion, '):',
            'audio:', audioTracks.length,
            'video:', videoTracks.length,
            'tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`).join(', '));

        if (audioTracks.length > 0) {
            const track = audioTracks[0];
            console.log('[ActiveCallModal] Remote audio track details:', {
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                label: track.label,
            });

            // Ensure track is enabled
            if (!track.enabled) {
                console.log('[ActiveCallModal] Enabling disabled audio track');
                track.enabled = true;
            }

            // Monitor track events
            track.onended = () => console.log('[ActiveCallModal] ⚠️ Remote audio track ENDED');
            track.onmute = () => console.log('[ActiveCallModal] Remote audio track muted event');
            track.onunmute = () => console.log('[ActiveCallModal] Remote audio track unmuted event');
        }

        // Force audio setup reset when stream version changes
        // This ensures new audio tracks from screen share renegotiation are heard
        audioSetupForStreamRef.current = null;

        // Setup audio with Web Audio API for volume control
        // Note: Using a ref to get current volume to avoid re-running on volume change
        setupAudioWithGain(remoteStream, volume);

        // Fix 4: Setup video with proper reset and retry logic
        if (remoteVideoRef.current) {
            const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');

            if (liveVideoTracks.length > 0) {
                console.log('[ActiveCallModal] Setting up video - live tracks:', liveVideoTracks.length,
                    'settings:', liveVideoTracks.map(t => {
                        const s = t.getSettings();
                        return `${t.id.substring(0, 8)}:${s.width}x${s.height}:${s.displaySurface || 'camera'}`;
                    }).join(', '));

                // CRITICAL: Clear srcObject before setting new stream to ensure browser resets video element
                remoteVideoRef.current.srcObject = null;

                // Small delay to ensure browser processes the reset
                setTimeout(() => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = remoteStream;

                        // Retry play with exponential backoff if blocked
                        const attemptPlay = (attempt = 1) => {
                            remoteVideoRef.current?.play().catch((err) => {
                                console.log('[ActiveCallModal] Video play attempt', attempt, 'blocked:', err.message);
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
                console.log('[ActiveCallModal] No live video tracks, clearing video element');
                remoteVideoRef.current.srcObject = null;
            }
        }

        // Cleanup
        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                sourceNodeRef.current?.disconnect();
                gainNodeRef.current?.disconnect();
                audioContextRef.current.close().catch(() => { });
                audioContextRef.current = null;
                gainNodeRef.current = null;
                sourceNodeRef.current = null;
                audioSetupForStreamRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remoteStream, remoteStreamVersion, setupAudioWithGain]); // volume intentionally omitted - handled by separate effect

    // Handle manual audio enable (for autoplay policy)
    const handleManualPlay = async () => {
        try {
            // Resume audio context if suspended
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
                console.log('[ActiveCallModal] AudioContext resumed manually');
            }

            // Re-setup audio if needed
            if (remoteStream) {
                audioSetupForStreamRef.current = null; // Force re-setup
                await setupAudioWithGain(remoteStream, volume);
            }
            setAudioPlaybackFailed(false);
        } catch (err) {
            console.error('Manual play failed:', err);
        }
    };

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
            {/* Hidden muted audio element - Chrome WebRTC workaround */}
            <audio
                ref={hiddenAudioRef}
                muted
                autoPlay
                playsInline
                className="hidden"
            />

            {/* Backup audio element (fallback) */}
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                className="hidden"
            />

            {/* Autoplay blocked warning */}
            {audioPlaybackFailed && remoteStream && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50">
                    <button
                        onClick={handleManualPlay}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium animate-pulse flex items-center gap-2"
                    >
                        <Volume2 size={20} />
                        Click to Enable Audio
                    </button>
                </div>
            )}

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

            {/* Main Video Area - Takes full remaining space with padding for controls */}
            <div className={`flex-1 relative flex items-center justify-center bg-[#1e1f22] overflow-hidden ${isFullscreen && isRemoteScreenShare ? 'p-0' : 'p-4 pb-24'
                }`}>
                {/* Use CallContainer for multi-participant grid layout */}
                <CallContainer
                    localStream={localStream}
                    localDisplayName="You"
                    isLocalMuted={isMuted}
                    isLocalVideoOn={isVideoOn}
                    isLocalSpeaking={isSpeaking}
                    isLocalScreenSharing={isScreenSharing}
                    localScreenStream={screenStream}
                    participants={participantsArray}
                    onStopScreenShare={onToggleScreenShare}
                />

                {/* Screen Share Indicator */}
                {isScreenSharing && (
                    <div className="absolute top-4 left-4 px-3 py-2 bg-green-500/90 rounded-lg flex items-center gap-2 text-white text-sm">
                        <MonitorUp size={16} />
                        You are sharing your screen
                    </div>
                )}
            </div>

            {/* Control Bar - Always visible, floating at bottom. In fullscreen with screen share, show on hover */}
            <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#1e1f22] via-[#1e1f22]/95 to-transparent ${isFullscreen && isRemoteScreenShare ? 'opacity-0 hover:opacity-100 transition-opacity duration-300' : ''
                }`}>
                <div className="flex items-center justify-center gap-3">
                    {/* Mute */}
                    <button
                        onClick={onToggleMute}
                        className={`p-4 rounded-full transition-all hover:scale-105 shadow-lg ${isMuted
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                            }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    {/* Device Settings */}
                    <DeviceSettingsPopover />

                    {/* Deafen */}
                    <button
                        onClick={onToggleDeafen}
                        className={`p-4 rounded-full transition-all hover:scale-105 shadow-lg ${isDeafened
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                            }`}
                        title={isDeafened ? 'Undeafen' : 'Deafen'}
                    >
                        {isDeafened ? <HeadphoneOff size={22} /> : <Headphones size={22} />}
                    </button>

                    {/* Video */}
                    <button
                        onClick={onToggleVideo}
                        className={`p-4 rounded-full transition-all hover:scale-105 shadow-lg ${!isVideoOn
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                            }`}
                        title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                        {isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
                    </button>

                    {/* Screen Share */}
                    <button
                        onClick={onToggleScreenShare}
                        className={`p-4 rounded-full transition-all hover:scale-105 shadow-lg ${isScreenSharing
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-[#3b3d44] text-white hover:bg-[#4b4d54]'
                            }`}
                        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                    >
                        <MonitorUp size={22} />
                    </button>

                    {/* End Call */}
                    <button
                        onClick={onEndCall}
                        className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all hover:scale-105 shadow-lg"
                        title="End Call"
                    >
                        <Phone size={22} className="rotate-[135deg]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
