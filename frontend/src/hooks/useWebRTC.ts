/**
 * useWebRTC Hook
 * Manages WebRTC peer connections with Appwrite Realtime signaling
 * 
 * @see https://appwrite.io/docs/apis/realtime
 * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { functions, databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { useRealtime } from '@/providers/RealtimeProvider';
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

    // Actions - joinChannel accepts optional overrides for when refs haven't updated yet
    joinChannel: (overrides?: { channelId?: string; targetUserId?: string; isInitiator?: boolean }) => Promise<void>;
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
    const connectionStateRef = useRef<ConnectionState>('disconnected');

    // Buffer for signals that arrive before we're ready to process them
    const pendingSignalsRef = useRef<WebRTCSignal[]>([]);
    
    // Queue ICE candidates that arrive before remote description is set
    const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

    // Keep refs synced with props/state
    useEffect(() => {
        channelIdRef.current = channelId;
    }, [channelId]);

    useEffect(() => {
        targetUserIdRef.current = targetUserId;
    }, [targetUserId]);

    // Get centralized Realtime subscription - NO MORE DUPLICATE WebSockets!
    const { subscribe: subscribeRealtime } = useRealtime();

    /**
     * Send signaling message via webrtc-signal function
     */
    const sendSignal = useCallback(async (
        toUserId: string,
        type: WebRTCSignal['type'],
        data: { sdp?: string; candidate?: string }
    ) => {
        // CRITICAL: Use REF for current channelId, not stale closure value
        const currentChannelId = channelIdRef.current;
        if (!currentChannelId) {
            console.error('sendSignal: No channelId available!');
            return;
        }

        await functions.createExecution(
            'webrtc-signal',
            JSON.stringify({
                action: type,
                channelId: currentChannelId,
                userId,
                data: {
                    targetUserId: toUserId,
                    sdp: data.sdp,
                    candidate: data.candidate ? JSON.parse(data.candidate) : undefined
                }
            }),
            false
        );
    }, [userId]); // Removed channelId - using channelIdRef

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
            console.log('[WebRTC] ontrack event received:', event.track.kind, 'from peer:', peerId);
            const [stream] = event.streams;

            if (!stream) {
                console.warn('[WebRTC] ontrack: No stream in event!');
                return;
            }

            setParticipants((prev) => {
                const updated = new Map(prev);
                const existing = updated.get(peerId);

                // CRITICAL: Always update with the new stream reference even if it looks the same
                // This ensures React detects the change when new tracks are added
                const hasVideoTrack = stream.getVideoTracks().length > 0;
                const hasAudioTrack = stream.getAudioTracks().length > 0;

                updated.set(peerId, {
                    odId: peerId,
                    displayName: existing?.displayName || 'Unknown',
                    isMuted: existing?.isMuted ?? false,
                    isDeafened: existing?.isDeafened ?? false,
                    isVideoOn: hasVideoTrack || (existing?.isVideoOn ?? false),
                    isScreenSharing: existing?.isScreenSharing ?? false,
                    isSpeaking: false,
                    stream,
                });

                console.log('[WebRTC] Updated participant:', peerId, 
                    'audio:', hasAudioTrack, 'video:', hasVideoTrack,
                    'tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`).join(', '));

                return updated;
            });
        };

        // NOTE: Local tracks are added BEFORE offer/answer creation, not here
        // This callback is only for setting up event handlers
    }, [sendSignal]); // Removed localStream from deps - using ref instead

    /**
     * Handle incoming signaling message
     */
    const handleSignal = useCallback(async (signal: WebRTCSignal) => {
        // Ignore own signals
        if (signal.fromUserId === userId) return;

        // Ignore signals not for us
        if (signal.toUserId !== 'all' && signal.toUserId !== userId) return;

        console.log('[WebRTC] handleSignal:', signal.type, 'from:', signal.fromUserId);

        const peerId = signal.fromUserId;
        let pc = peerConnectionsRef.current.get(peerId);

        // Create peer connection if doesn't exist
        if (!pc) {
            console.log('[WebRTC] Creating new peer connection for:', peerId);
            pc = createPeerConnection();
            setupPeerConnection(pc, peerId);
            peerConnectionsRef.current.set(peerId, pc);
        }

        try {
            switch (signal.type) {
                case 'offer': {
                    if (!signal.sdp) {
                        console.warn('[WebRTC] Offer received without SDP!');
                        break;
                    }

                    // CRITICAL FIX: Check signaling state before processing offer
                    // We should only accept offer in "stable" state
                    if (pc.signalingState !== 'stable') {
                        console.warn('[WebRTC] Received offer but signaling state is:', pc.signalingState, '- may need glare handling');
                        // In case of glare (both sent offers), the one with lower userId should be the offerer
                        // For now, just log and continue - may need more sophisticated handling
                    }

                    // CRITICAL: Add local tracks BEFORE setting remote description
                    // Without this, receiver's audio/video won't be sent
                    const stream = localStreamRef.current;
                    if (stream) {
                        const existingSenders = pc.getSenders();
                        stream.getTracks().forEach((track) => {
                            if (!existingSenders.find(s => s.track === track)) {
                                console.log('[WebRTC] Adding local track to PC:', track.kind);
                                pc.addTrack(track, stream);
                            }
                        });
                    } else {
                        console.warn('[WebRTC] No local stream available when processing offer!');
                    }

                    await pc.setRemoteDescription({
                        type: 'offer',
                        sdp: signal.sdp,
                    });
                    console.log('[WebRTC] Remote description (offer) set');

                    // CRITICAL: Flush any queued ICE candidates now that remote description is set
                    const queuedCandidates = pendingIceCandidatesRef.current.get(peerId) || [];
                    if (queuedCandidates.length > 0) {
                        console.log('[WebRTC] Flushing', queuedCandidates.length, 'queued ICE candidates');
                        for (const candidate of queuedCandidates) {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                        pendingIceCandidatesRef.current.delete(peerId);
                    }

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    console.log('[WebRTC] Local description (answer) set');

                    await sendSignal(peerId, 'answer', {
                        sdp: answer.sdp,
                    });
                    console.log('[WebRTC] Answer sent to:', peerId);
                    break;
                }

                case 'answer': {
                    if (!signal.sdp) {
                        console.warn('[WebRTC] Answer received without SDP!');
                        break;
                    }

                    // Check if we're in the right state to accept an answer
                    if (pc.signalingState !== 'have-local-offer') {
                        console.warn('[WebRTC] Received answer but signaling state is:', pc.signalingState);
                        break;
                    }

                    await pc.setRemoteDescription({
                        type: 'answer',
                        sdp: signal.sdp,
                    });
                    console.log('[WebRTC] Remote description (answer) set, connection should establish');

                    // CRITICAL: Flush any queued ICE candidates now that remote description is set
                    const queuedCandidates = pendingIceCandidatesRef.current.get(peerId) || [];
                    if (queuedCandidates.length > 0) {
                        console.log('[WebRTC] Flushing', queuedCandidates.length, 'queued ICE candidates');
                        for (const candidate of queuedCandidates) {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                        pendingIceCandidatesRef.current.delete(peerId);
                    }
                    break;
                }

                case 'ice-candidate': {
                    if (!signal.candidate) break;

                    const candidate = parseIceCandidate(signal.candidate);
                    if (!candidate) break;

                    // CRITICAL FIX: Queue ICE candidates if remote description not yet set
                    // This prevents "cannot add ICE candidate before setRemoteDescription" errors
                    if (!pc.remoteDescription) {
                        console.log('[WebRTC] Queueing ICE candidate (no remote description yet)');
                        const queue = pendingIceCandidatesRef.current.get(peerId) || [];
                        queue.push(candidate);
                        pendingIceCandidatesRef.current.set(peerId, queue);
                    } else {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('[WebRTC] ICE candidate added');
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('[WebRTC] Error handling signal:', signal.type, err);
        }
    }, [userId, sendSignal, setupPeerConnection]);

    // Track if subscription is active to trigger re-subscription when channelId changes
    const [activeChannelId, setActiveChannelId] = useState<string>('');

    // Subscribe to WebRTC signals via CENTRALIZED RealtimeProvider
    useEffect(() => {
        if (!activeChannelId) return;

        console.log('[WebRTC] Setting up signal subscription for channel:', activeChannelId);

        const unsubscribe = subscribeRealtime((event) => {
            if (event.collection !== COLLECTIONS.WEBRTC_SIGNALS) return;

            const signal = event.payload as WebRTCSignal;

            if (signal.channelId !== activeChannelId) return;

            if (connectionStateRef.current === 'disconnected') {
                console.log('[WebRTC] Buffering signal:', signal.type, 'from:', signal.fromUserId);
                pendingSignalsRef.current.push(signal);
            } else {
                handleSignal(signal);
            }
        });

        unsubscribeRef.current = unsubscribe;

        return () => {
            unsubscribe();
            unsubscribeRef.current = null;
        };
    }, [activeChannelId, handleSignal, subscribeRealtime]);


    const joinChannel = useCallback(async (overrides?: { channelId?: string; targetUserId?: string; isInitiator?: boolean }) => {
        if (connectionState !== 'disconnected') return;

        const effectiveChannelId = overrides?.channelId || channelIdRef.current;
        const effectiveTargetUserId = overrides?.targetUserId || targetUserIdRef.current;
        const effectiveIsInitiator = overrides?.isInitiator !== undefined ? overrides.isInitiator : isInitiator;

        if (!effectiveChannelId) {
            console.error('[WebRTC] joinChannel: No channelId provided!');
            return;
        }

        channelIdRef.current = effectiveChannelId;
        if (effectiveTargetUserId) {
            targetUserIdRef.current = effectiveTargetUserId;
        }

        setConnectionState('connecting');
        connectionStateRef.current = 'connecting';
        setError(null);
        
        // CRITICAL: Set activeChannelId to trigger subscription useEffect
        setActiveChannelId(effectiveChannelId);

        try {
            const stream = await getUserMedia(false);
            localStreamRef.current = stream;
            setLocalStream(stream);

            await functions.createExecution('webrtc-signal', JSON.stringify({
                action: 'join',
                channelId: effectiveChannelId,
                userId,
                data: {}
            }), false);

            voiceDetectorCleanupRef.current = createVoiceActivityDetector(
                stream,
                setIsSpeaking
            );

            if (effectiveIsInitiator) {
                if (mode === 'dm' && effectiveTargetUserId) {
                    const pc = createPeerConnection();

                    stream.getTracks().forEach((track) => {
                        pc.addTrack(track, stream);
                    });

                    setupPeerConnection(pc, effectiveTargetUserId);
                    peerConnectionsRef.current.set(effectiveTargetUserId, pc);

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    await sendSignal(effectiveTargetUserId, 'offer', {
                        sdp: offer.sdp,
                    });
                    
                    console.log('[WebRTC] Offer sent to:', effectiveTargetUserId);
                } else {
                    const pc = createPeerConnection();

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
            } else {
                console.log('[WebRTC] Receiver mode - waiting for offer from:', effectiveTargetUserId);
                
                // CRITICAL: Fetch existing signals from database
                // Realtime only delivers NEW events, not existing documents!
                // The offer may have been created before we subscribed
                try {
                    const existingSignals = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.WEBRTC_SIGNALS,
                        [
                            Query.equal('channelId', effectiveChannelId),
                            Query.equal('toUserId', userId),
                            Query.orderAsc('$createdAt')
                        ]
                    );
                    
                    if (existingSignals.documents.length > 0) {
                        console.log('[WebRTC] Found', existingSignals.documents.length, 'existing signals');
                        for (const doc of existingSignals.documents) {
                            const signal = doc as unknown as WebRTCSignal;
                            await handleSignal(signal);
                        }
                    }
                } catch (fetchErr) {
                    console.error('[WebRTC] Failed to fetch existing signals:', fetchErr);
                }
            }

            // Process any buffered signals from Realtime
            if (pendingSignalsRef.current.length > 0) {
                console.log('[WebRTC] Processing', pendingSignalsRef.current.length, 'buffered signals');
                const bufferedSignals = [...pendingSignalsRef.current];
                pendingSignalsRef.current = [];
                for (const signal of bufferedSignals) {
                    await handleSignal(signal);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to join channel';
            setError(message);
            setConnectionState('failed');
            connectionStateRef.current = 'failed';
        }
    }, [connectionState, handleSignal, sendSignal, setupPeerConnection, mode, isInitiator]); // Removed channelId/targetUserId - using refs

    /**
     * Leave voice channel
     */
    const leaveChannel = useCallback(() => {
        // CRITICAL FIX: Guard against calling leaveChannel when already disconnected
        // This prevents double-cleanup and potential errors
        if (connectionStateRef.current === 'disconnected') {
            console.log('[WebRTC] leaveChannel called but already disconnected, skipping');
            return;
        }

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

        // Clear any pending signals buffer
        pendingSignalsRef.current = [];
        
        // Clear any pending ICE candidates
        pendingIceCandidatesRef.current.clear();

        // Reset state
        setParticipants(new Map());
        setConnectionState('disconnected');
        connectionStateRef.current = 'disconnected';
        setActiveChannelId(''); // Clear to unsubscribe from signals
        setIsMuted(false);
        setIsDeafened(false);
        setIsVideoOn(false);
        setIsScreenSharing(false);
        setIsSpeaking(false);
    }, [userId, screenStream]);

    /**
     * Toggle mute
     * CRITICAL FIX: Use ref instead of state to avoid stale closure issues
     */
    const toggleMute = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isMuted; // Toggle (if muted, enable; if unmuted, disable)
            setIsMuted(!isMuted);
        }
    }, [isMuted]);

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
     * CRITICAL FIX: Use ref instead of state to avoid stale closure issues
     */
    const toggleVideo = useCallback(async () => {
        const stream = localStreamRef.current;
        if (!stream) return;

        if (isVideoOn) {
            // Turn off video - stop tracks and remove from peer connections
            stream.getVideoTracks().forEach((track) => {
                track.stop();
                stream.removeTrack(track);
            });
            
            // CRITICAL FIX: Remove video senders from peer connections
            peerConnectionsRef.current.forEach((pc) => {
                pc.getSenders().forEach((sender) => {
                    if (sender.track?.kind === 'video') {
                        pc.removeTrack(sender);
                    }
                });
            });
            
            setIsVideoOn(false);
        } else {
            // Turn on video
            try {
                const videoStream = await getUserMedia(true);
                const videoTrack = videoStream.getVideoTracks()[0];

                if (videoTrack) {
                    // Use ref to get current stream
                    const currentStream = localStreamRef.current;
                    if (currentStream) {
                        currentStream.addTrack(videoTrack);
                    }

                    // CRITICAL FIX: Check if video sender exists, replace track if so
                    // Otherwise add new track
                    peerConnectionsRef.current.forEach((pc) => {
                        const existingVideoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                        if (existingVideoSender) {
                            // Replace existing track
                            existingVideoSender.replaceTrack(videoTrack);
                        } else if (currentStream) {
                            // Add new track
                            pc.addTrack(videoTrack, currentStream);
                        }
                    });
                }
                setIsVideoOn(true);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to start video';
                setError(message);
            }
        }
    }, [isVideoOn]);

    /**
     * Stop screen sharing
     */
    const stopScreenShare = useCallback(() => {
        if (!screenStream) return;

        // CRITICAL FIX: Remove screen share tracks from peer connections
        // Otherwise the remote sees a frozen frame
        const screenTracks = screenStream.getTracks();
        peerConnectionsRef.current.forEach((pc) => {
            pc.getSenders().forEach((sender) => {
                if (sender.track && screenTracks.includes(sender.track)) {
                    pc.removeTrack(sender);
                }
            });
        });

        // Stop all tracks
        screenTracks.forEach((track) => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);
        console.log('[WebRTC] Screen share stopped');
    }, [screenStream]);

    /**
     * Start screen sharing (60fps 1080p)
     */
    const startScreenShare = useCallback(async () => {
        if (isScreenSharing) return;

        try {
            const stream = await getDisplayMedia();
            setScreenStream(stream);
            console.log('[WebRTC] Screen share stream obtained');

            // CRITICAL FIX: Use for...of instead of forEach for proper async handling
            const peerConnections = Array.from(peerConnectionsRef.current.values());
            for (const pc of peerConnections) {
                stream.getTracks().forEach((track) => {
                    // Check if track already added
                    const existingSender = pc.getSenders().find(s => s.track === track);
                    if (!existingSender) {
                        pc.addTrack(track, stream);
                        console.log('[WebRTC] Added screen track to peer connection');
                    }
                });

                await setVideoBitrate(pc, BITRATE_CONFIG.screenShare);
            }

            // Handle stream end (user clicks stop in browser UI)
            stream.getVideoTracks()[0].onended = () => {
                console.log('[WebRTC] Screen share ended by user');
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
            // Clear pending signals and ICE candidates
            pendingSignalsRef.current = [];
            pendingIceCandidatesRef.current.clear();
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
