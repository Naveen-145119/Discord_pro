/**
 * useWebRTC Hook
 * Manages WebRTC peer connections with Appwrite Realtime signaling
 * 
 * @see https://appwrite.io/docs/apis/realtime
 * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { client, functions, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import {
    createPeerConnection,
    getUserMedia,
    getDisplayMedia,
    setVideoBitrate,
    createVoiceActivityDetector,
    parseIceCandidate,
    BITRATE_CONFIG,
    type ConnectionState,
    type CallParticipant,
    type WebRTCSignal,
} from '@/lib/webrtc';
// ID import removed - no longer using direct database writes

// Use COLLECTIONS constant for consistency
const SIGNALS_COLLECTION = COLLECTIONS.WEBRTC_SIGNALS;

interface UseWebRTCProps {
    channelId: string;
    userId: string;
    displayName: string;
    mode?: 'channel' | 'dm'; //Channel for multi-party, DM for 1:1 calls
    targetUserId?: string; // Required for DM mode - the other user's ID
    isInitiator?: boolean; // True for caller, false for receiver (receiver waits for offer)
}

interface UseWebRTCReturn {
    // State
    connectionState: ConnectionState;
    localStream: MediaStream | null;
    participants: Map<string, CallParticipant>;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    error: string | null;

    // Actions
    joinChannel: () => Promise<void>;
    leaveChannel: () => void;
    toggleMute: () => void;
    toggleDeafen: () => void;
    toggleVideo: () => Promise<void>;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
}

export function useWebRTC({
    channelId,
    userId,
    displayName: _displayName,
    mode = 'channel',
    targetUserId,
    isInitiator = true, // Default to true for backward compatibility
}: UseWebRTCProps): UseWebRTCReturn {
    // Connection state
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [error, setError] = useState<string | null>(null);

    // Media state
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [participants, setParticipants] = useState<Map<string, CallParticipant>>(new Map());

    // User controls
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Refs for cleanup
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const voiceDetectorCleanupRef = useRef<(() => void) | null>(null);

    // Refs to fix stale closure issues in callbacks
    const localStreamRef = useRef<MediaStream | null>(null);
    const channelIdRef = useRef(channelId);
    const targetUserIdRef = useRef(targetUserId);

    // Keep refs synced with props/state
    useEffect(() => {
        channelIdRef.current = channelId;
    }, [channelId]);

    useEffect(() => {
        targetUserIdRef.current = targetUserId;
    }, [targetUserId]);

    /**
     * Send signaling message via webrtc-signal function
     */
    const sendSignal = useCallback(async (
        toUserId: string,
        type: WebRTCSignal['type'],
        data: { sdp?: string; candidate?: string }
    ) => {
        await functions.createExecution(
            'webrtc-signal',
            JSON.stringify({
                action: type,
                channelId,
                userId,
                data: {
                    targetUserId: toUserId,
                    sdp: data.sdp,
                    candidate: data.candidate ? JSON.parse(data.candidate) : undefined
                }
            }),
            false
        );
    }, [channelId, userId]);

    /**
     * Setup peer connection event handlers
     */
    const setupPeerConnection = useCallback((
        pc: RTCPeerConnection,
        peerId: string
    ) => {
        // ICE candidate
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                await sendSignal(peerId, 'ice-candidate', {
                    candidate: JSON.stringify(event.candidate.toJSON()),
                });
            }
        };

        // Connection state
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (state === 'connected') {
                setConnectionState('connected');
            } else if (state === 'failed' || state === 'disconnected') {
                setConnectionState('failed');
            }
        };

        // Remote stream
        pc.ontrack = (event) => {
            const [stream] = event.streams;

            setParticipants((prev) => {
                const updated = new Map(prev);
                const existing = updated.get(peerId);

                updated.set(peerId, {
                    odId: peerId,
                    displayName: existing?.displayName || 'Unknown',
                    isMuted: existing?.isMuted ?? false,
                    isDeafened: existing?.isDeafened ?? false,
                    isVideoOn: existing?.isVideoOn ?? false,
                    isScreenSharing: existing?.isScreenSharing ?? false,
                    isSpeaking: false,
                    stream,
                });

                return updated;
            });
        };

        // Add local tracks - Use REF to avoid stale closure
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });
        }
    }, [sendSignal]); // Removed localStream from deps - using ref instead

    /**
     * Handle incoming signaling message
     */
    const handleSignal = useCallback(async (signal: WebRTCSignal) => {
        // Ignore own signals
        if (signal.fromUserId === userId) return;

        // Ignore signals not for us
        if (signal.toUserId !== 'all' && signal.toUserId !== userId) return;

        const peerId = signal.fromUserId;
        let pc = peerConnectionsRef.current.get(peerId);

        // Create peer connection if doesn't exist
        if (!pc) {
            pc = createPeerConnection();
            setupPeerConnection(pc, peerId);
            peerConnectionsRef.current.set(peerId, pc);
        }

        try {
            switch (signal.type) {
                case 'offer': {
                    if (!signal.sdp) break;

                    // CRITICAL: Add local tracks BEFORE setting remote description
                    // Without this, receiver's audio/video won't be sent
                    if (localStreamRef.current) {
                        localStreamRef.current.getTracks().forEach((track) => {
                            if (!pc.getSenders().find(s => s.track === track)) {
                                pc.addTrack(track, localStreamRef.current!);
                            }
                        });
                    }

                    await pc.setRemoteDescription({
                        type: 'offer',
                        sdp: signal.sdp,
                    });

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    await sendSignal(peerId, 'answer', {
                        sdp: answer.sdp,
                    });
                    break;
                }

                case 'answer': {
                    if (!signal.sdp) break;

                    await pc.setRemoteDescription({
                        type: 'answer',
                        sdp: signal.sdp,
                    });
                    break;
                }

                case 'ice-candidate': {
                    if (!signal.candidate) break;

                    const candidate = parseIceCandidate(signal.candidate);
                    if (candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('Error handling signal:', err);
        }
    }, [userId, sendSignal, setupPeerConnection]);



    /**
     * Join voice channel
     */
    const joinChannel = useCallback(async () => {
        if (connectionState !== 'disconnected') return;

        setConnectionState('connecting');
        setError(null);

        try {
            // Get local audio stream
            const stream = await getUserMedia(false);
            localStreamRef.current = stream; // CRITICAL: Sync ref immediately
            setLocalStream(stream);

            // Register voice state with backend - use REF for current channelId
            await functions.createExecution('webrtc-signal', JSON.stringify({
                action: 'join',
                channelId: channelIdRef.current,
                userId,
                data: {}
            }), false);

            // Setup voice activity detection
            voiceDetectorCleanupRef.current = createVoiceActivityDetector(
                stream,
                setIsSpeaking
            );

            // Subscribe to signaling via Appwrite Realtime
            const channel = `databases.${DATABASE_ID}.collections.${SIGNALS_COLLECTION}.documents`;

            unsubscribeRef.current = client.subscribe(channel, (response: {
                events: string[];
                payload: unknown;
            }) => {
                const signal = response.payload as WebRTCSignal;

                // Only handle signals for this channel - use REF for current value
                if (signal.channelId === channelIdRef.current) {
                    handleSignal(signal);
                }
            });

            // Only initiator (caller) sends offer
            // Receiver will get offer via Realtime and respond with answer in handleSignal
            if (isInitiator) {
                if (mode === 'dm' && targetUserId) {
                    // DM mode: Create targeted peer connection to the other user
                    const pc = createPeerConnection();

                    // Add local tracks BEFORE creating offer (critical for WebRTC)
                    stream.getTracks().forEach((track) => {
                        pc.addTrack(track, stream);
                    });

                    setupPeerConnection(pc, targetUserId);
                    peerConnectionsRef.current.set(targetUserId, pc);

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    await sendSignal(targetUserId, 'offer', {
                        sdp: offer.sdp,
                    });
                } else {
                    // Channel mode: Broadcast offer to all participants
                    const pc = createPeerConnection();

                    // Add local tracks BEFORE creating offer (critical for WebRTC)
                    stream.getTracks().forEach((track) => {
                        pc.addTrack(track, stream);
                    });

                    setupPeerConnection(pc, 'all');

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    await sendSignal('all', 'offer', {
                        sdp: offer.sdp,
                    });
                }
            }
            // If not initiator (receiver), we just set up media and wait for offer

            setConnectionState('connected');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to join channel';
            setError(message);
            setConnectionState('failed');
        }
    }, [channelId, connectionState, handleSignal, sendSignal, setupPeerConnection, mode, targetUserId, isInitiator]);

    /**
     * Leave voice channel
     */
    const leaveChannel = useCallback(() => {
        // Notify backend of leaving (fire and forget) - use REF for current channelId
        functions.createExecution('webrtc-signal', JSON.stringify({
            action: 'leave',
            channelId: channelIdRef.current,
            userId,
            data: {}
        }), false).catch(() => { });

        // Stop local stream
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        // Stop screen share
        screenStream?.getTracks().forEach((track) => track.stop());
        setScreenStream(null);

        // Close all peer connections
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();

        // Unsubscribe from Realtime
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;

        // Cleanup voice detector
        voiceDetectorCleanupRef.current?.();
        voiceDetectorCleanupRef.current = null;

        // Reset state
        setParticipants(new Map());
        setConnectionState('disconnected');
        setIsMuted(false);
        setIsDeafened(false);
        setIsVideoOn(false);
        setIsScreenSharing(false);
        setIsSpeaking(false);
    }, [userId, screenStream]); // Removed localStream - using localStreamRef

    /**
     * Toggle mute
     */
    const toggleMute = useCallback(() => {
        if (!localStream) return;

        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isMuted; // Toggle
            setIsMuted(!isMuted);
        }
    }, [localStream, isMuted]);

    /**
     * Toggle deafen
     */
    const toggleDeafen = useCallback(() => {
        const newDeafened = !isDeafened;
        setIsDeafened(newDeafened);

        // Mute all remote streams
        participants.forEach((participant) => {
            if (participant.stream) {
                participant.stream.getAudioTracks().forEach((track) => {
                    track.enabled = !newDeafened;
                });
            }
        });

        // Also mute self when deafened
        if (newDeafened && !isMuted) {
            toggleMute();
        }
    }, [isDeafened, isMuted, participants, toggleMute]);

    /**
     * Toggle video
     */
    const toggleVideo = useCallback(async () => {
        if (!localStream) return;

        if (isVideoOn) {
            // Turn off video
            localStream.getVideoTracks().forEach((track) => {
                track.stop();
                localStream.removeTrack(track);
            });
            setIsVideoOn(false);
        } else {
            // Turn on video
            try {
                const videoStream = await getUserMedia(true);
                const videoTrack = videoStream.getVideoTracks()[0];

                if (videoTrack) {
                    localStream.addTrack(videoTrack);

                    // Add to all peer connections
                    peerConnectionsRef.current.forEach((pc) => {
                        pc.addTrack(videoTrack, localStream);
                    });
                }
                setIsVideoOn(true);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to start video';
                setError(message);
            }
        }
    }, [localStream, isVideoOn]);

    /**
     * Stop screen sharing
     */
    const stopScreenShare = useCallback(() => {
        if (!screenStream) return;

        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);
    }, [screenStream]);

    /**
     * Start screen sharing (60fps 1080p)
     */
    const startScreenShare = useCallback(async () => {
        if (isScreenSharing) return;

        try {
            const stream = await getDisplayMedia();
            setScreenStream(stream);

            // Add to all peer connections with high bitrate
            peerConnectionsRef.current.forEach(async (pc) => {
                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                await setVideoBitrate(pc, BITRATE_CONFIG.screenShare);
            });

            // Handle stream end (user clicks stop)
            stream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };

            setIsScreenSharing(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to share screen';
            setError(message);
        }
    }, [isScreenSharing, stopScreenShare]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Stop local stream
            localStream?.getTracks().forEach((track) => track.stop());
            // Stop screen share
            screenStream?.getTracks().forEach((track) => track.stop());
            // Close all peer connections
            peerConnectionsRef.current.forEach((pc) => pc.close());
            peerConnectionsRef.current.clear();
            // Unsubscribe from Realtime
            unsubscribeRef.current?.();
            // Cleanup voice detector
            voiceDetectorCleanupRef.current?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        connectionState,
        localStream,
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
    };
}
