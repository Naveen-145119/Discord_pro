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
    mode?: 'channel' | 'dm';
    targetUserId?: string;
    isInitiator?: boolean;
}

interface UseWebRTCReturn {
    connectionState: ConnectionState;
    localStream: MediaStream | null;
    participants: Map<string, CallParticipant>;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    error: string | null;
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
    isInitiator = true,
}: UseWebRTCProps): UseWebRTCReturn {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [participants, setParticipants] = useState<Map<string, CallParticipant>>(new Map());
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const voiceDetectorCleanupRef = useRef<(() => void) | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const channelIdRef = useRef(channelId);
    const targetUserIdRef = useRef(targetUserId);
    const connectionStateRef = useRef<ConnectionState>('disconnected');
    const pendingSignalsRef = useRef<WebRTCSignal[]>([]);
    const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    
    // Track processed signal IDs to prevent duplicate processing
    const processedSignalIdsRef = useRef<Set<string>>(new Set());
    
    // Track which peer connections have been established (received answer)
    const establishedConnectionsRef = useRef<Set<string>>(new Set());
    
    // Track if we've sent an offer to each peer (to handle glare)
    const sentOffersRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        channelIdRef.current = channelId;
    }, [channelId]);

    useEffect(() => {
        targetUserIdRef.current = targetUserId;
    }, [targetUserId]);

    const { subscribe: subscribeRealtime } = useRealtime();

    const sendSignal = useCallback(async (
        toUserId: string,
        type: WebRTCSignal['type'],
        data: { sdp?: string; candidate?: string }
    ) => {
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
    }, [userId]);

    const setupPeerConnection = useCallback((
        pc: RTCPeerConnection,
        peerId: string
    ) => {
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                await sendSignal(peerId, 'ice-candidate', {
                    candidate: JSON.stringify(event.candidate.toJSON()),
                });
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log('[WebRTC] Connection state changed:', state, 'for peer:', peerId);
            if (state === 'connected') {
                setConnectionState('connected');
                console.log('[WebRTC] ✅ PEER CONNECTION ESTABLISHED with:', peerId);
            } else if (state === 'failed' || state === 'disconnected') {
                console.log('[WebRTC] ❌ Connection failed/disconnected:', state);
                setConnectionState('failed');
            }
        };
        
        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
        };

        pc.ontrack = (event) => {
            console.log('[WebRTC] ontrack event received:', event.track.kind, 'from peer:', peerId);
            const [stream] = event.streams;
            
            // Log detailed track info
            const track = event.track;
            console.log('[WebRTC] Received track details:', {
                kind: track.kind,
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
            });

            // Monitor track state changes
            track.onended = () => {
                console.log('[WebRTC] Remote track ENDED:', track.kind, 'from peer:', peerId);
            };
            track.onmute = () => {
                console.log('[WebRTC] Remote track MUTED:', track.kind, 'from peer:', peerId);
            };
            track.onunmute = () => {
                console.log('[WebRTC] Remote track UNMUTED:', track.kind, 'from peer:', peerId);
            };

            if (!stream) {
                console.warn('[WebRTC] ontrack: No stream in event!');
                return;
            }

            setParticipants((prev) => {
                const updated = new Map(prev);
                const existing = updated.get(peerId);

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
    }, [sendSignal]);

    const handleSignal = useCallback(async (signal: WebRTCSignal) => {
        if (signal.fromUserId === userId) return;
        if (signal.toUserId !== 'all' && signal.toUserId !== userId) return;

        // Check if signal has expired (signals are valid for 30 seconds)
        if (signal.expiresAt) {
            const expiryTime = new Date(signal.expiresAt).getTime();
            const now = Date.now();
            if (now > expiryTime) {
                console.log('[WebRTC] Skipping EXPIRED signal:', signal.type, 'expired', Math.round((now - expiryTime) / 1000), 'seconds ago');
                return;
            }
        }

        // Deduplicate signals - skip if already processed
        const signalId = signal.$id;
        if (signalId && processedSignalIdsRef.current.has(signalId)) {
            console.log('[WebRTC] Skipping duplicate signal:', signal.type, signalId);
            return;
        }
        if (signalId) {
            processedSignalIdsRef.current.add(signalId);
        }

        console.log('[WebRTC] handleSignal:', signal.type, 'from:', signal.fromUserId, 'id:', signalId);

        const peerId = signal.fromUserId;
        let pc = peerConnectionsRef.current.get(peerId);

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

                    // Handle renegotiation offers (when connection is already established)
                    const isRenegotiation = establishedConnectionsRef.current.has(peerId) && 
                                           pc.connectionState === 'connected';
                    
                    if (isRenegotiation) {
                        console.log('[WebRTC] Handling renegotiation offer from:', peerId);
                        // For renegotiation, we can accept offers even when established
                    } else if (establishedConnectionsRef.current.has(peerId)) {
                        // Connection established but not in connected state - skip
                        console.log('[WebRTC] Ignoring offer - connection already in progress with:', peerId);
                        break;
                    }

                    // Handle glare (both peers sent offers simultaneously)
                    // Use lexicographic comparison of user IDs to determine who should be polite
                    const weArePolite = userId > peerId;
                    
                    if (pc.signalingState === 'have-local-offer') {
                        if (weArePolite) {
                            // We're polite: rollback our offer and accept theirs
                            console.log('[WebRTC] Glare detected - we are polite, rolling back our offer');
                            await pc.setLocalDescription({ type: 'rollback' });
                            sentOffersRef.current.delete(peerId);
                        } else {
                            // We're impolite: ignore their offer, they should accept ours
                            console.log('[WebRTC] Glare detected - we are impolite, ignoring their offer');
                            break;
                        }
                    } else if (pc.signalingState !== 'stable' && !isRenegotiation) {
                        console.log('[WebRTC] Ignoring offer, signaling state is:', pc.signalingState);
                        break;
                    }

                    const stream = localStreamRef.current;
                    if (stream) {
                        const existingSenders = pc.getSenders();
                        stream.getTracks().forEach((track) => {
                            if (!existingSenders.find(s => s.track === track)) {
                                console.log('[WebRTC] Adding local track to PC:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
                                pc.addTrack(track, stream);
                            }
                        });
                        
                        // Verify tracks were added
                        const senders = pc.getSenders();
                        console.log('[WebRTC] PeerConnection now has', senders.length, 'senders:', 
                            senders.map(s => s.track ? `${s.track.kind}:${s.track.enabled}` : 'null').join(', '));
                    } else {
                        console.error('[WebRTC] ⚠️ CRITICAL: No local stream available when processing offer! The other peer will not receive our audio.');
                    }

                    await pc.setRemoteDescription({
                        type: 'offer',
                        sdp: signal.sdp,
                    });
                    console.log('[WebRTC] Remote description (offer) set');

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

                    // Mark connection as established BEFORE sending answer to prevent duplicate answers
                    establishedConnectionsRef.current.add(peerId);

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

                    // Check signaling state first - we need to be in have-local-offer to accept answer
                    if (pc.signalingState !== 'have-local-offer') {
                        console.log('[WebRTC] Received answer but signaling state is:', pc.signalingState, '- ignoring');
                        break;
                    }

                    // Accept the answer (this handles both initial connection AND renegotiation)
                    await pc.setRemoteDescription({
                        type: 'answer',
                        sdp: signal.sdp,
                    });
                    
                    // Mark this connection as established
                    establishedConnectionsRef.current.add(peerId);
                    console.log('[WebRTC] Remote description (answer) set, connection established/renegotiated with:', peerId);

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

    const [activeChannelId, setActiveChannelId] = useState<string>('');

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

        setActiveChannelId(effectiveChannelId);

        try {
            const stream = await getUserMedia(false);
            localStreamRef.current = stream;
            setLocalStream(stream);
            
            // Log local audio track status
            const audioTrack = stream.getAudioTracks()[0];
            console.log('[WebRTC] Local audio track:', audioTrack ? 
                `enabled:${audioTrack.enabled} muted:${audioTrack.muted} readyState:${audioTrack.readyState}` : 
                'NO AUDIO TRACK!');

            // Monitor local audio track state
            if (audioTrack) {
                audioTrack.onended = () => {
                    console.log('[WebRTC] ⚠️ Local audio track ENDED unexpectedly');
                };
                audioTrack.onmute = () => {
                    console.log('[WebRTC] Local audio track muted');
                };
                audioTrack.onunmute = () => {
                    console.log('[WebRTC] Local audio track unmuted');
                };
            }

            await functions.createExecution('webrtc-signal', JSON.stringify({
                action: 'join',
                channelId: effectiveChannelId,
                userId,
                data: {}
            }), false);

            voiceDetectorCleanupRef.current = createVoiceActivityDetector(
                stream,
                setIsSpeaking  // Removed verbose logging - voice detector works fine
            );
            
            // Also do a quick audio level check to verify mic is working
            try {
                const audioContext = new AudioContext();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                let checkCount = 0;
                const checkMic = setInterval(() => {
                    analyser.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    console.log('[WebRTC] Local mic level:', avg.toFixed(2));
                    checkCount++;
                    if (checkCount >= 3) {
                        clearInterval(checkMic);
                        source.disconnect();
                        audioContext.close();
                    }
                }, 1000);
            } catch (e) {
                console.log('[WebRTC] Could not check local mic level:', e);
            }

            if (effectiveIsInitiator) {
                if (mode === 'dm' && effectiveTargetUserId) {
                    const pc = createPeerConnection();

                    stream.getTracks().forEach((track) => {
                        console.log('[WebRTC] Initiator adding track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
                        pc.addTrack(track, stream);
                    });
                    
                    // Verify senders
                    const senders = pc.getSenders();
                    console.log('[WebRTC] Initiator PeerConnection has', senders.length, 'senders');

                    setupPeerConnection(pc, effectiveTargetUserId);
                    peerConnectionsRef.current.set(effectiveTargetUserId, pc);

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    sentOffersRef.current.add(effectiveTargetUserId);
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

                try {
                    // Only fetch signals that haven't expired yet
                    const now = new Date().toISOString();
                    const existingSignals = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.WEBRTC_SIGNALS,
                        [
                            Query.equal('channelId', effectiveChannelId),
                            Query.equal('toUserId', userId),
                            Query.greaterThan('expiresAt', now),  // Only non-expired signals
                            Query.orderAsc('$createdAt')
                        ]
                    );

                    if (existingSignals.documents.length > 0) {
                        console.log('[WebRTC] Found', existingSignals.documents.length, 'valid (non-expired) signals');
                        for (const doc of existingSignals.documents) {
                            const signal = doc as unknown as WebRTCSignal;
                            await handleSignal(signal);
                        }
                    } else {
                        console.log('[WebRTC] No valid signals found, waiting for new ones via realtime');
                    }
                } catch (fetchErr) {
                    console.error('[WebRTC] Failed to fetch existing signals:', fetchErr);
                }
            }

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
    }, [connectionState, handleSignal, sendSignal, setupPeerConnection, mode, isInitiator]);

    const leaveChannel = useCallback(() => {
        if (connectionStateRef.current === 'disconnected') {
            console.log('[WebRTC] leaveChannel called but already disconnected, skipping');
            return;
        }

        console.log('[WebRTC] leaveChannel called, stopping local tracks');

        functions.createExecution('webrtc-signal', JSON.stringify({
            action: 'leave',
            channelId: channelIdRef.current,
            userId,
            data: {}
        }), false).catch(() => { });

        localStreamRef.current?.getTracks().forEach((track) => {
            console.log('[WebRTC] Stopping local track:', track.kind, 'id:', track.id);
            track.stop();
        });
        localStreamRef.current = null;
        setLocalStream(null);

        screenStream?.getTracks().forEach((track) => track.stop());
        setScreenStream(null);

        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();

        unsubscribeRef.current?.();
        unsubscribeRef.current = null;

        voiceDetectorCleanupRef.current?.();
        voiceDetectorCleanupRef.current = null;

        pendingSignalsRef.current = [];

        pendingIceCandidatesRef.current.clear();
        
        // Clear processed signal IDs for fresh start on next call
        processedSignalIdsRef.current.clear();
        
        // Clear established connections tracking
        establishedConnectionsRef.current.clear();
        sentOffersRef.current.clear();

        setParticipants(new Map());
        setConnectionState('disconnected');
        connectionStateRef.current = 'disconnected';
        setActiveChannelId('');
        setIsMuted(false);
        setIsDeafened(false);
        setIsVideoOn(false);
        setIsScreenSharing(false);
        setIsSpeaking(false);
    }, [userId, screenStream]);

    const toggleMute = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isMuted;
            setIsMuted(!isMuted);
        }
    }, [isMuted]);

    const toggleDeafen = useCallback(() => {
        const newDeafened = !isDeafened;
        setIsDeafened(newDeafened);

        participants.forEach((participant) => {
            if (participant.stream) {
                participant.stream.getAudioTracks().forEach((track) => {
                    track.enabled = !newDeafened;
                });
            }
        });

        if (newDeafened && !isMuted) {
            toggleMute();
        }
    }, [isDeafened, isMuted, participants, toggleMute]);

    const toggleVideo = useCallback(async () => {
        const stream = localStreamRef.current;
        if (!stream) return;

        if (isVideoOn) {
            stream.getVideoTracks().forEach((track) => {
                track.stop();
                stream.removeTrack(track);
            });

            peerConnectionsRef.current.forEach((pc) => {
                pc.getSenders().forEach((sender) => {
                    if (sender.track?.kind === 'video') {
                        pc.removeTrack(sender);
                    }
                });
            });

            setIsVideoOn(false);
        } else {
            try {
                const videoStream = await getUserMedia(true);
                const videoTrack = videoStream.getVideoTracks()[0];

                if (videoTrack) {
                    const currentStream = localStreamRef.current;
                    if (currentStream) {
                        currentStream.addTrack(videoTrack);
                    }

                    // Add track to all peer connections and renegotiate
                    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
                        const existingVideoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                        if (existingVideoSender) {
                            await existingVideoSender.replaceTrack(videoTrack);
                            console.log('[WebRTC] Replaced video track for peer:', peerId);
                        } else if (currentStream) {
                            pc.addTrack(videoTrack, currentStream);
                            console.log('[WebRTC] Added video track for peer:', peerId);
                            
                            // Renegotiation is needed when adding new track
                            try {
                                const offer = await pc.createOffer();
                                await pc.setLocalDescription(offer);
                                await sendSignal(peerId, 'offer', { sdp: offer.sdp });
                                console.log('[WebRTC] Sent renegotiation offer for video to:', peerId);
                            } catch (err) {
                                console.error('[WebRTC] Failed to renegotiate for video:', err);
                            }
                        }
                    }
                }
                setIsVideoOn(true);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to start video';
                setError(message);
            }
        }
    }, [isVideoOn, sendSignal]);

    const stopScreenShare = useCallback(() => {
        if (!screenStream) return;

        const screenTracks = screenStream.getTracks();
        peerConnectionsRef.current.forEach((pc) => {
            pc.getSenders().forEach((sender) => {
                if (sender.track && screenTracks.includes(sender.track)) {
                    pc.removeTrack(sender);
                }
            });
        });

        screenTracks.forEach((track) => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);
        console.log('[WebRTC] Screen share stopped');
    }, [screenStream]);

    const startScreenShare = useCallback(async () => {
        if (isScreenSharing) return;

        try {
            const stream = await getDisplayMedia();
            setScreenStream(stream);
            console.log('[WebRTC] Screen share stream obtained, tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`).join(', '));

            // Get the screen video track
            const screenVideoTrack = stream.getVideoTracks()[0];
            // Get screen audio track if available (system audio)
            const screenAudioTrack = stream.getAudioTracks()[0];

            // Add screen share tracks to all peer connections with renegotiation
            for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
                // Add screen video track
                if (screenVideoTrack) {
                    pc.addTrack(screenVideoTrack, stream);
                    console.log('[WebRTC] Added screen video track to peer connection:', peerId);
                }

                // Add screen audio track if available (system audio from screen)
                if (screenAudioTrack) {
                    pc.addTrack(screenAudioTrack, stream);
                    console.log('[WebRTC] Added screen audio track to peer connection:', peerId);
                }

                // IMPORTANT: Ensure microphone audio track is still being sent
                // The local stream's audio track should already be added, but let's verify
                const localAudioTrack = localStreamRef.current?.getAudioTracks()[0];
                if (localAudioTrack) {
                    const audioSenders = pc.getSenders().filter(s => s.track?.kind === 'audio');
                    const hasLocalAudio = audioSenders.some(s => s.track?.id === localAudioTrack.id);
                    if (!hasLocalAudio && localStreamRef.current) {
                        // Re-add the local audio track if it's missing
                        pc.addTrack(localAudioTrack, localStreamRef.current);
                        console.log('[WebRTC] Re-added local microphone audio track to peer connection:', peerId);
                    } else {
                        console.log('[WebRTC] Local microphone audio track already present, enabled:', localAudioTrack.enabled);
                    }
                    // Make sure it's enabled (not muted)
                    if (!isMuted) {
                        localAudioTrack.enabled = true;
                    }
                }

                await setVideoBitrate(pc, BITRATE_CONFIG.screenShare);
                
                // Renegotiate to inform peer about new tracks
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await sendSignal(peerId, 'offer', { sdp: offer.sdp });
                    console.log('[WebRTC] Sent renegotiation offer for screen share to:', peerId);
                } catch (err) {
                    console.error('[WebRTC] Failed to renegotiate for screen share:', err);
                }
            }

            // Handle screen share stop event
            if (screenVideoTrack) {
                screenVideoTrack.onended = () => {
                    console.log('[WebRTC] Screen share ended by user');
                    stopScreenShare();
                };
            }

            setIsScreenSharing(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to share screen';
            setError(message);
        }
    }, [isScreenSharing, isMuted, stopScreenShare, sendSignal]);

    useEffect(() => {
        return () => {
            localStream?.getTracks().forEach((track) => track.stop());
            screenStream?.getTracks().forEach((track) => track.stop());
            peerConnectionsRef.current.forEach((pc) => pc.close());
            peerConnectionsRef.current.clear();
            unsubscribeRef.current?.();
            voiceDetectorCleanupRef.current?.();
            pendingSignalsRef.current = [];
            pendingIceCandidatesRef.current.clear();
        };
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
