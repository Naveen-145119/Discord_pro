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

    useEffect(() => {
        if (!remoteStream) {
            console.log('[ActiveCallModal] No remote stream yet');
            return;
        }

        const audioTracks = remoteStream.getAudioTracks();
        console.log('[ActiveCallModal] Remote stream received, tracks:',
            remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`).join(', '));

        if (audioTracks.length > 0) {
            const track = audioTracks[0];
            console.log('[ActiveCallModal] Remote audio track details:', {
                id: track.id,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                settings: track.getSettings(),
            });

            // Ensure the track is enabled
            if (!track.enabled) {
                console.log('[ActiveCallModal] Enabling disabled audio track');
                track.enabled = true;
            }

            track.onmute = () => console.log('[ActiveCallModal] Remote audio track MUTED');
            track.onunmute = () => console.log('[ActiveCallModal] Remote audio track UNMUTED');
            track.onended = () => console.log('[ActiveCallModal] Remote audio track ENDED');
        } else {
            console.warn('[ActiveCallModal] NO AUDIO TRACKS in remote stream!');
        }

        const audioElement = remoteAudioRef.current;
        if (audioElement) {
            // Clear previous srcObject first
            audioElement.srcObject = null;
            
            // Set the new stream
            audioElement.srcObject = remoteStream;
            audioElement.volume = 1.0;
            audioElement.muted = false;

            // Wait a brief moment before playing to ensure stream is ready
            const playAudio = async () => {
                try {
                    // Resume AudioContext if suspended (needed for some browsers)
                    if (typeof AudioContext !== 'undefined') {
                        const tempContext = new AudioContext();
                        if (tempContext.state === 'suspended') {
                            await tempContext.resume();
                        }
                        tempContext.close();
                    }

                    await audioElement.play();
                    console.log('[ActiveCallModal] Audio playback started successfully, volume:',
                        audioElement.volume, 'muted:', audioElement.muted);
                    setAudioPlaybackFailed(false);

                    // Analyze audio levels for debugging
                    try {
                        const audioContext = new AudioContext();
                        await audioContext.resume();
                        const source = audioContext.createMediaStreamSource(remoteStream);
                        const analyser = audioContext.createAnalyser();
                        analyser.fftSize = 256;
                        source.connect(analyser);
                        // Also connect to destination to ensure audio plays
                        // (some browsers need this for the stream to actually output)
                        
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);
                        let checkCount = 0;
                        const checkInterval = setInterval(() => {
                            analyser.getByteFrequencyData(dataArray);
                            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                            console.log('[ActiveCallModal] Audio level:', average.toFixed(2));
                            checkCount++;
                            if (checkCount >= 5) {
                                clearInterval(checkInterval);
                                source.disconnect();
                                audioContext.close();
                            }
                        }, 1000);
                    } catch (e) {
                        console.log('[ActiveCallModal] Could not analyze audio:', e);
                    }
                } catch (err) {
                    console.error('[ActiveCallModal] Audio autoplay blocked:', (err as Error).name, (err as Error).message);
                    setAudioPlaybackFailed(true);
                }
            };

            // Small delay to ensure stream tracks are active
            setTimeout(playAudio, 100);
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch((err) => {
                console.log('[ActiveCallModal] Video autoplay blocked:', err.message);
            });
        }
        
        // Cleanup function
        return () => {
            if (audioElement) {
                audioElement.pause();
                audioElement.srcObject = null;
            }
        };
    }, [remoteStream]);

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
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                className="hidden"
            />

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

            <div className="flex-1 relative flex items-center justify-center">
                {remoteStream && (remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')) ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
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

            <div className="p-6 flex items-center justify-center gap-4">
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
