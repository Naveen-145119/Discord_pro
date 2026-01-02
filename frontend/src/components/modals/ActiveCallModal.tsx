/**
 * Active Call Modal - Full screen call UI when in a call
 * 
 * CRITICAL: This modal handles both voice and video calls.
 * Audio MUST play regardless of video state!
 */
import { useRef, useEffect, useState } from 'react';
import { Phone, Video, MonitorUp, Mic, MicOff, VideoOff } from 'lucide-react';
import type { ActiveCall } from '@/hooks/useCall';
import type { User } from '@/types';

interface ActiveCallModalProps {
    call: ActiveCall;
    friend: User;
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isCalling: boolean;
    onEndCall: () => void;
    onToggleMute: () => void;
    onToggleVideo: () => Promise<void>;
    onToggleScreenShare: () => Promise<void>;
}

export function ActiveCallModal({
    call,
    friend,
    isMuted,
    isVideoOn,
    isScreenSharing,
    localStream,
    remoteStream,
    isCalling,
    onEndCall,
    onToggleMute,
    onToggleVideo,
    onToggleScreenShare,
}: ActiveCallModalProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [audioPlaybackFailed, setAudioPlaybackFailed] = useState(false);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Attach remote stream and attempt playback
    useEffect(() => {
        if (!remoteStream) {
            console.log('[ActiveCallModal] No remote stream yet');
            return;
        }

        console.log('[ActiveCallModal] Remote stream received, tracks:', 
            remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`).join(', '));

        // Attach to hidden audio element
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            
            // Try to play immediately
            const playPromise = remoteAudioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('[ActiveCallModal] Audio playback started successfully');
                        setAudioPlaybackFailed(false);
                    })
                    .catch((err) => {
                        console.error('[ActiveCallModal] Audio autoplay blocked:', err.name, err.message);
                        setAudioPlaybackFailed(true);
                    });
            }
        }

        // Attach to video element
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch((err) => {
                console.log('[ActiveCallModal] Video autoplay blocked:', err.message);
            });
        }
    }, [remoteStream]);

    // Manual play handler for when autoplay is blocked
    const handleManualPlay = async () => {
        try {
            if (remoteAudioRef.current) {
                await remoteAudioRef.current.play();
            }
            if (remoteVideoRef.current) {
                await remoteVideoRef.current.play();
            }
            setAudioPlaybackFailed(false);
        } catch (err) {
            console.error('Manual play failed:', err);
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'idle': return 'bg-yellow-500';
            case 'dnd': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-[100]">
            {/* CRITICAL: Hidden audio element that ALWAYS plays remote audio */}
            {/* This ensures audio works even when video element is conditionally hidden */}
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
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium animate-pulse"
                    >
                        🔊 Click to Enable Audio
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-discord-primary flex items-center justify-center">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-lg font-medium text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${getStatusColor(friend.status)}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{friend.displayName}</h3>
                        <p className="text-sm text-gray-400">
                            {isCalling ? 'Ringing...' : call.callType === 'video' ? 'Video Call' : 'Voice Call'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main video area */}
            <div className="flex-1 relative flex items-center justify-center">
                {/* Remote video or avatar */}
                {/* CRITICAL FIX: Safely check for video tracks with null guards */}
                {remoteStream && (remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')) ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        // CRITICAL: Do NOT mute - audio is handled by hidden audio element as backup
                        // but video element should also play audio for better sync
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-32 h-32 rounded-full bg-discord-primary flex items-center justify-center mb-4">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-5xl font-bold text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{friend.displayName}</h2>
                        {isCalling ? (
                            <p className="text-gray-400 animate-pulse">Calling...</p>
                        ) : remoteStream ? (
                            <p className="text-green-400 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                Voice Connected
                            </p>
                        ) : (
                            <p className="text-yellow-400 animate-pulse">Connecting...</p>
                        )}
                    </div>
                )}

                {/* Local video (picture-in-picture) */}
                {localStream && isVideoOn && (
                    <div className="absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-700">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                        />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="p-6 flex items-center justify-center gap-4">
                {/* Mute */}
                <button
                    onClick={onToggleMute}
                    className={`p-4 rounded-full transition-all hover:scale-110 ${isMuted
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {/* Video */}
                <button
                    onClick={onToggleVideo}
                    className={`p-4 rounded-full transition-all hover:scale-110 ${!isVideoOn
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                    title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                    {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                {/* Screen Share - 1080p 60fps */}
                <button
                    onClick={onToggleScreenShare}
                    className={`p-4 rounded-full transition-all hover:scale-110 ${isScreenSharing
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen (1080p 60fps)'}
                >
                    <MonitorUp size={24} />
                </button>

                {/* End Call */}
                <button
                    onClick={onEndCall}
                    className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all hover:scale-110"
                    title="End Call"
                >
                    <Phone size={24} className="rotate-[135deg]" />
                </button>
            </div>

            <style>{`
                .mirror {
                    transform: scaleX(-1);
                }
            `}</style>
        </div>
    );
}
