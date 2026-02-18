import { useCallback, useEffect, useRef, useState } from 'react';
import { functions, databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { useRealtime } from '@/providers/RealtimeProvider';
import {
    createPeerConnection,
    getUserMedia,
    getAudioConstraints,
    getVideoConstraints,
    getDisplayMedia,
    setVideoBitrate,
    createVoiceActivityDetector,
    parseIceCandidate,
    createProcessedAudioStream,
    patchSdpForOpus,
    BITRATE_CONFIG,
    type AudioPipelineControls,
    type ConnectionState,
    type CallParticipant,
    type WebRTCSignal,
} from '@/lib/webrtc';
import { useMediaStore } from '@/stores/mediaStore';
import { replaceTrackInConnection, getTrackFromDevice } from '@/hooks/useMediaDevices';

interface UseWebRTCProps {
    channelId: string;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    mode?: 'channel' | 'dm';
    targetUserId?: string;
    targetUserInfo?: { displayName: string; avatarUrl?: string };
    isInitiator?: boolean;
}

interface UseWebRTCReturn {
    connectionState: ConnectionState;
    localStream: MediaStream | null;
    screenStream: MediaStream | null;
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
    avatarUrl: _avatarUrl,
    mode = 'channel',
    targetUserId,
    targetUserInfo,
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

    // Subscribe to store changes for device switching
    const inputDeviceId = useMediaStore(state => state.inputDeviceId);
    const videoDeviceId = useMediaStore(state => state.videoDeviceId);

    // Subscribe to store for Push-to-Talk
    const inputMode = useMediaStore(state => state.inputMode);
    const pushToTalkKey = useMediaStore(state => state.pushToTalkKey);

    // Subscribe to store for live audio processing settings
    const inputProfile = useMediaStore(state => state.inputProfile);
    const noiseSuppressionLevel = useMediaStore(state => state.noiseSuppressionLevel);
    const inputVolume = useMediaStore(state => state.inputVolume);
    const vadSensitivity = useMediaStore(state => state.vadSensitivity);

    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const voiceDetectorCleanupRef = useRef<(() => void) | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const channelIdRef = useRef(channelId);
    const targetUserIdRef = useRef(targetUserId);
    const connectionStateRef = useRef<ConnectionState>('disconnected');
    const pendingSignalsRef = useRef<WebRTCSignal[]>([]);
    const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    // Tracks peers for whom we've broadcast isScreenSharing=true but the offer hasn't arrived yet.
    // Used as a race-condition fallback in ontrack screen-share detection.
    const pendingScreenSharePeersRef = useRef<Set<string>>(new Set());

    // Track processed signal IDs to prevent duplicate processing
    const processedSignalIdsRef = useRef<Set<string>>(new Set());

    // Track which peer connections have been established (received answer)
    const establishedConnectionsRef = useRef<Set<string>>(new Set());

    // Track if we've sent an offer to each peer (to handle glare)
    const sentOffersRef = useRef<Set<string>>(new Set());

    // Synchronous guard for screen sharing to prevent rapid clicks
    const isScreenSharingRef = useRef(false);

    // Cinema Mode: Audio mixing refs (merges mic + system audio for screen share)
    const audioMixerContextRef = useRef<AudioContext | null>(null);
    const mixedAudioStreamRef = useRef<MediaStream | null>(null);
    const micGainNodeRef = useRef<GainNode | null>(null);
    const systemGainNodeRef = useRef<GainNode | null>(null);

    // Full audio processing pipeline controls (noise gate, gain, profile switching)
    const audioPipelineRef = useRef<AudioPipelineControls | null>(null);

    // ── Live-wire settings panel → audio pipeline ──────────────────────────
    // These effects subscribe to mediaStore and apply changes in real-time
    // without needing to restart the call.

    // 1. Input Profile changes (Voice Isolation / Studio / Custom)
    useEffect(() => {
        const pipeline = audioPipelineRef.current;
        if (!pipeline) return;
        const state = useMediaStore.getState();
        pipeline.setProfile(inputProfile, {
            noiseGateThreshold: state.noiseSuppressionLevel === 'krisp' ? 0.008
                : state.noiseSuppressionLevel === 'standard' ? 0.015
                    : 0.03,
        });
        console.log('[WebRTC] Live: input profile changed to', inputProfile);
    }, [inputProfile]);

    // 2. Noise Suppression Level changes (Krisp / Standard / None)
    useEffect(() => {
        const pipeline = audioPipelineRef.current;
        if (!pipeline || inputProfile !== 'custom') return;
        const threshold = noiseSuppressionLevel === 'krisp' ? 0.008
            : noiseSuppressionLevel === 'standard' ? 0.015
                : 0.03;
        pipeline.setGateThreshold(threshold);
        pipeline.setGateEnabled(noiseSuppressionLevel !== 'none');
        console.log('[WebRTC] Live: noise suppression level changed to', noiseSuppressionLevel);
    }, [noiseSuppressionLevel, inputProfile]);

    // 3. Input Volume changes (0–200 → 0–2 gain)
    useEffect(() => {
        const pipeline = audioPipelineRef.current;
        if (!pipeline) return;
        pipeline.setInputGain(inputVolume / 100);
        console.log('[WebRTC] Live: input volume changed to', inputVolume);
    }, [inputVolume]);

    // 4. VAD Sensitivity changes (only in custom/voice-activity mode)
    useEffect(() => {
        const pipeline = audioPipelineRef.current;
        if (!pipeline || inputProfile !== 'custom') return;
        // vadSensitivity is -100 to 0 dB → convert to 0–1 RMS threshold
        // -100dB = very sensitive (0.001), 0dB = not sensitive (0.1)
        const threshold = Math.pow(10, vadSensitivity / 20) * 0.1;
        pipeline.setGateThreshold(Math.max(0.001, Math.min(0.1, threshold)));
        console.log('[WebRTC] Live: VAD sensitivity changed to', vadSensitivity, '→ threshold', threshold.toFixed(4));
    }, [vadSensitivity, inputProfile]);

    // 5. Push-to-Talk: global keydown/keyup listener
    useEffect(() => {
        if (inputMode !== 'push-to-talk') return;
        if (connectionStateRef.current === 'disconnected') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code !== pushToTalkKey) return;
            // Unmute while key held
            const stream = localStreamRef.current;
            if (stream) stream.getAudioTracks().forEach(t => { t.enabled = true; });
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code !== pushToTalkKey) return;
            // Mute when key released
            const stream = localStreamRef.current;
            if (stream) stream.getAudioTracks().forEach(t => { t.enabled = false; });
        };

        // Start muted in PTT mode
        const stream = localStreamRef.current;
        if (stream) stream.getAudioTracks().forEach(t => { t.enabled = false; });

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            // Re-enable tracks when leaving PTT mode
            const s = localStreamRef.current;
            if (s) s.getAudioTracks().forEach(t => { t.enabled = true; });
        };
    }, [inputMode, pushToTalkKey, connectionState]);

    // Dynamic Device Switching Logic
    const handleDeviceChange = useCallback(async (kind: 'audio' | 'video', deviceId: string) => {
        if (!localStreamRef.current) return;

        // Avoid redundant switching if already on that device
        const currentTrack = kind === 'audio'
            ? localStreamRef.current.getAudioTracks()[0]
            : localStreamRef.current.getVideoTracks()[0];

        if (!currentTrack) return;

        console.log(`[WebRTC] Switching ${kind} device to:`, deviceId);

        try {
            // 1. Get new track
            const newTrack = await getTrackFromDevice(kind, deviceId);
            if (!newTrack) {
                console.warn(`[WebRTC] Failed to get new ${kind} track`);
                return;
            }

            // 2. Stop old track and replace in local stream
            currentTrack.stop();
            localStreamRef.current?.removeTrack(currentTrack);
            localStreamRef.current?.addTrack(newTrack);

            // Force React update for local view and to notify context
            const newStream = new MediaStream(localStreamRef.current?.getTracks() || []);
            setLocalStream(newStream);

            // 3. Replace in all peer connections
            for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
                console.log(`[WebRTC] Replacing track for peer ${peerId}`);
                await replaceTrackInConnection(pc, newTrack, currentTrack.id);
            }
        } catch (err) {
            console.error(`[WebRTC] Error switching ${kind} device:`, err);
        }
    }, []);

    // Handle Audio Input Change
    useEffect(() => {
        if (inputDeviceId && inputDeviceId !== 'default') {
            handleDeviceChange('audio', inputDeviceId);
        }
    }, [inputDeviceId, handleDeviceChange]);

    // Handle Video Input Change
    useEffect(() => {
        if (videoDeviceId && videoDeviceId !== 'default') {
            // Only switch if video is actively on
            const hasVideo = (localStreamRef.current?.getVideoTracks().length ?? 0) > 0;
            if (hasVideo) {
                handleDeviceChange('video', videoDeviceId);
            }
        }
    }, [videoDeviceId, handleDeviceChange]);

    // Target user info for participant display (displayName, avatarUrl)
    const targetUserInfoRef = useRef(targetUserInfo);

    useEffect(() => {
        channelIdRef.current = channelId;
    }, [channelId]);

    useEffect(() => {
        targetUserIdRef.current = targetUserId;
    }, [targetUserId]);

    useEffect(() => {
        targetUserInfoRef.current = targetUserInfo;
    }, [targetUserInfo]);

    const { subscribe: subscribeRealtime } = useRealtime();

    /**
     * Dynamic Bandwidth Management
     * Adjusts video bitrate based on participant count and screen sharing state:
     * - ≤2 participants: 1.5 Mbps (high quality)
     * - >2 participants: 500 Kbps (low quality to reduce lag)
     * - Screen sharing: 2.5 Mbps for screen, 200 Kbps for camera
     */
    const updateBitrateConfig = useCallback(async (
        participantCount: number,
        currentlyScreenSharing: boolean
    ) => {
        // Determine base bitrate based on participant count
        const baseBitrate = participantCount <= 2
            ? BITRATE_CONFIG.videoMedium  // 1.5 Mbps for small calls
            : BITRATE_CONFIG.videoLow;     // 500 Kbps for larger calls

        console.log('[WebRTC] Updating bitrate config:', {
            participantCount,
            currentlyScreenSharing,
            baseBitrate: baseBitrate / 1000 + ' Kbps',
        });

        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();

            for (const sender of senders) {
                if (!sender.track || sender.track.kind !== 'video') continue;

                try {
                    const params = sender.getParameters();
                    if (!params.encodings || params.encodings.length === 0) {
                        params.encodings = [{}];
                    }

                    // Determine if this is a screen share track or camera track
                    // Screen share tracks typically have different labels
                    const isScreenTrack = sender.track.label?.includes('screen') ||
                        sender.track.label?.includes('monitor') ||
                        sender.track.label?.includes('window') ||
                        sender.track.label?.includes('display');

                    let targetBitrate: number;

                    if (currentlyScreenSharing) {
                        if (isScreenTrack) {
                            // Screen content gets priority bandwidth
                            targetBitrate = 2_500_000; // 2.5 Mbps for screen
                        } else {
                            // Camera is aggressively throttled when screen sharing
                            targetBitrate = 200_000; // 200 Kbps for camera
                        }
                    } else {
                        targetBitrate = baseBitrate;
                    }

                    params.encodings[0].maxBitrate = targetBitrate;
                    await sender.setParameters(params);

                    console.log('[WebRTC] Set bitrate for', peerId,
                        isScreenTrack ? '(screen)' : '(camera)',
                        '→', targetBitrate / 1000, 'Kbps');
                } catch (err) {
                    console.error('[WebRTC] Failed to set bitrate for sender:', err);
                }
            }
        }
    }, []);


    const sendSignal = useCallback(async (
        toUserId: string,
        type: WebRTCSignal['type'],
        data: { sdp?: string; candidate?: string; userState?: WebRTCSignal['userState'] }
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
                    candidate: data.candidate ? JSON.parse(data.candidate) : undefined,
                    userInfo: {
                        displayName: _displayName,
                        avatarUrl: _avatarUrl,
                        isMuted: isMuted, // Include current state
                        isDeafened: isDeafened
                    },
                    userState: data.userState
                }
            }),
            false
        );
    }, [userId, isMuted, isDeafened]); // Added dependencies for current state

    const broadcastState = useCallback(async (
        newState: {
            isMuted: boolean;
            isDeafened: boolean;
            isVideoOn: boolean;
            isScreenSharing: boolean;
        }
    ) => {
        // Broadcast to all connected peers
        const peers = Array.from(peerConnectionsRef.current.keys());

        console.log('[WebRTC] Broadcasting state update to', peers.length, 'peers:', newState);

        for (const peerId of peers) {
            await sendSignal(peerId, 'state-update', {
                userState: newState
            });
        }
    }, [sendSignal]);

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
            const trackSettings = track.getSettings();
            const connectionState = pc.connectionState;

            console.log('[WebRTC] Received track details:', {
                kind: track.kind,
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                streamId: stream?.id,
                label: track.label,
                displaySurface: trackSettings.displaySurface,
                width: trackSettings.width,
                height: trackSettings.height,
                connectionState: connectionState,
            });

            // Detect if this is a screen share track
            // Strategy: In DM calls, the initial connection is audio-only.
            // If we receive a VIDEO track during renegotiation (connection is already established),
            // it's likely a screen share since video calls would have had video from the start.
            // Also check displaySurface if available (local detection)
            const isRenegotiation = connectionState === 'connected' || connectionState === 'connecting';
            const hasExistingParticipant = participants.has(peerId);

            const isScreenShareTrack = track.kind === 'video' && (
                // Local detection (works when sharing)
                trackSettings.displaySurface === 'monitor' ||
                trackSettings.displaySurface === 'window' ||
                trackSettings.displaySurface === 'browser' ||
                // Remote detection: if we already have a connection and receive new video = screen share
                (isRenegotiation && hasExistingParticipant) ||
                // Fallback: large dimensions or screen in label
                (trackSettings.width && trackSettings.width >= 1920) ||
                track.label.toLowerCase().includes('screen')
            );

            console.log('[WebRTC] Screen share detection:', {
                isRenegotiation,
                hasExistingParticipant,
                trackKind: track.kind,
                result: isScreenShareTrack
            });

            if (isScreenShareTrack) {
                console.log('[WebRTC] 📺 Detected SCREEN SHARE track from peer:', peerId);
            }

            // Monitor track state changes - IMPORTANT: Remove track from participant when it ends
            track.onended = () => {
                console.log('[WebRTC] Remote track ENDED:', track.kind, 'from peer:', peerId);
                setParticipants((prev) => {
                    const updated = new Map(prev);
                    const existing = updated.get(peerId);
                    if (!existing) return updated;

                    // Check if the ended track is the screen share track
                    const isScreenTrack = existing.screenStream?.getTracks().some(t => t.id === track.id);

                    if (isScreenTrack) {
                        // Screen share track ended — clear screenStream
                        console.log('[WebRTC] Screen share track ended for peer:', peerId);
                        updated.set(peerId, {
                            ...existing,
                            screenStream: undefined,
                            isScreenSharing: false,
                        });
                        return updated;
                    }

                    if (existing.stream) {
                        // ALWAYS create a new MediaStream object so React detects the change
                        const newStream = new MediaStream();

                        // Only add tracks that are still live and not the ended track
                        existing.stream.getTracks().forEach(t => {
                            if (t.id !== track.id && t.readyState === 'live') {
                                newStream.addTrack(t);
                                console.log('[WebRTC] Keeping track:', t.kind, t.id.substring(0, 8), 'state:', t.readyState);
                            } else {
                                console.log('[WebRTC] Removing track:', t.kind, t.id.substring(0, 8), 'state:', t.readyState);
                            }
                        });

                        const liveVideoTracks = newStream.getVideoTracks().filter(t => t.readyState === 'live');
                        const liveAudioTracks = newStream.getAudioTracks().filter(t => t.readyState === 'live');

                        console.log('[WebRTC] After cleanup - peer:', peerId,
                            'audio:', liveAudioTracks.length, 'video:', liveVideoTracks.length);

                        updated.set(peerId, {
                            ...existing,
                            stream: newStream,
                            isVideoOn: liveVideoTracks.length > 0,
                            isScreenSharing: liveVideoTracks.length > 0 ? existing.isScreenSharing : false,
                        });
                    }
                    return updated;
                });
            };
            track.onmute = () => {
                console.log('[WebRTC] Remote track MUTED:', track.kind, 'from peer:', peerId);
                if (track.kind === 'video') {
                    // When remote camera is turned off, the track is MUTED (not ended).
                    // readyState stays 'live' but no frames are delivered.
                    // We must update isVideoOn so the UI shows the avatar fallback.
                    setParticipants(prev => {
                        const updated = new Map(prev);
                        const existing = updated.get(peerId);
                        if (!existing) return updated;

                        // Only update if this track belongs to the main stream (not screenStream)
                        const isMainVideoTrack = existing.stream?.getVideoTracks().some(t => t.id === track.id);
                        if (isMainVideoTrack) {
                            updated.set(peerId, { ...existing, isVideoOn: false });
                        }
                        return updated;
                    });
                }
            };
            track.onunmute = () => {
                console.log('[WebRTC] Remote track UNMUTED:', track.kind, 'from peer:', peerId);
                if (track.kind === 'video') {
                    // Camera turned back on — restore isVideoOn
                    setParticipants(prev => {
                        const updated = new Map(prev);
                        const existing = updated.get(peerId);
                        if (!existing) return updated;

                        const isMainVideoTrack = existing.stream?.getVideoTracks().some(t => t.id === track.id);
                        if (isMainVideoTrack) {
                            updated.set(peerId, { ...existing, isVideoOn: true });
                        }
                        return updated;
                    });
                }
            };

            if (!stream) {
                console.warn('[WebRTC] ontrack: No stream in event!');
                return;
            }

            setParticipants((prev) => {
                const updated = new Map(prev);
                const existing = updated.get(peerId);

                // DETECT SCREEN SHARE - Multi-signal approach
                // The state-update signal (sent by broadcastState BEFORE renegotiation)
                // sets existing.isScreenSharing = true. We use that as the primary signal.
                // Fallback: displaySurface metadata (only available on sender side, not receiver).
                // Fallback 2: isAdditionalVideoTrack (only works when camera is also on).

                const hasExistingVideo = existing?.isVideoOn;

                // If the existing stream ALREADY has a video track, this second video track is likely a screen share
                const isAdditionalVideoTrack = hasExistingVideo &&
                    track.id !== existing?.stream?.getVideoTracks()[0]?.id;

                const isScreenShare = track.kind === 'video' && (
                    // 1. PRIMARY: Peer already told us they're screen sharing via state-update signal
                    //    (broadcastState is called BEFORE renegotiation in startScreenShare)
                    existing?.isScreenSharing === true ||
                    // 2. FALLBACK: We sent broadcastState but state-update may not be processed yet
                    //    (race condition: offer arrives before state-update is applied to React state)
                    pendingScreenSharePeersRef.current.has(peerId) ||
                    // 3. Explicit display surface (reliable if available, but only on sender side)
                    trackSettings.displaySurface === 'monitor' ||
                    trackSettings.displaySurface === 'window' ||
                    trackSettings.displaySurface === 'browser' ||
                    // 4. Track label indications
                    track.label.toLowerCase().includes('screen') ||
                    // 5. Fallback Heuristic: If we already have a main video track, and we get another one => Screen Share
                    isAdditionalVideoTrack
                );

                // Clear the pending flag once we've used it
                if (pendingScreenSharePeersRef.current.has(peerId)) {
                    pendingScreenSharePeersRef.current.delete(peerId);
                }

                console.log('[WebRTC] Screen share detection:', {
                    peerId,
                    trackKind: track.kind,
                    trackId: track.id,
                    existingIsScreenSharing: existing?.isScreenSharing,
                    existingVideoTracks: existing?.stream?.getVideoTracks().length || 0,
                    isAdditionalVideoTrack,
                    displaySurface: trackSettings.displaySurface,
                    result: isScreenShare
                });

                // For screen share tracks, create/update screenStream separately
                if (isScreenShare && track.kind === 'video') {
                    console.log('[WebRTC] 📺 Storing screen share track for peer:', peerId);
                    const screenMediaStream = new MediaStream();
                    screenMediaStream.addTrack(track);

                    // Use cached user info (from signal) or existing info or "User" fallback
                    const displayName = existing?.displayName || targetUserInfoRef.current?.displayName || 'User';
                    const avatarUrl = existing?.avatarUrl || targetUserInfoRef.current?.avatarUrl;

                    updated.set(peerId, {
                        ...existing,
                        odId: peerId, // Ensure odId is set
                        displayName,
                        avatarUrl,
                        isMuted: existing?.isMuted ?? false,
                        isDeafened: existing?.isDeafened ?? false,
                        isVideoOn: existing?.isVideoOn ?? false,
                        isScreenSharing: true,
                        isSpeaking: existing?.isSpeaking ?? false,
                        stream: existing?.stream, // Keep existing camera stream
                        cameraStream: existing?.cameraStream,
                        screenStream: screenMediaStream, // Store screen share separately
                    });

                    return updated;
                }

                // Handling Standard Camera/Audio Tracks
                // ALWAYS create a new MediaStream to ensure React detects changes
                const newStream = new MediaStream();

                if (!existing?.stream) {
                    // First track - use all tracks from the incoming stream
                    stream.getTracks().forEach(t => {
                        if (t.readyState === 'live') {
                            newStream.addTrack(t);
                        }
                    });
                } else {
                    // We have an existing stream - carefully merge tracks

                    if (track.kind === 'audio') {
                        // For audio: keep existing audio tracks and add new one if not duplicate
                        existing.stream.getAudioTracks().forEach(t => {
                            if (t.readyState === 'live' && t.id !== track.id) {
                                newStream.addTrack(t);
                            }
                        });
                        if (track.readyState === 'live') {
                            newStream.addTrack(track);
                        }
                        // Keep existing video tracks
                        existing.stream.getVideoTracks().forEach(t => {
                            if (t.readyState === 'live') {
                                newStream.addTrack(t);
                            }
                        });
                        console.log('[WebRTC] Added/updated audio track for peer:', peerId);
                    } else if (track.kind === 'video') {
                        // For video: We decided this is NOT a screen share, so it's a camera track.
                        // We replace the current camera track.

                        // Keep only audio tracks from existing stream
                        existing.stream.getAudioTracks().forEach(t => {
                            if (t.readyState === 'live') {
                                newStream.addTrack(t);
                            }
                        });

                        // Add the NEW video track
                        if (track.readyState === 'live') {
                            newStream.addTrack(track);
                            console.log('[WebRTC] Replaced video track for peer:', peerId,
                                'old video tracks:', existing.stream.getVideoTracks().length,
                                'new track:', track.id.substring(0, 8));
                        }
                    }
                }

                const liveVideoTracks = newStream.getVideoTracks().filter(t => t.readyState === 'live');
                const liveAudioTracks = newStream.getAudioTracks().filter(t => t.readyState === 'live');

                // Use cached user info (from signal) or existing info or "User" fallback
                const displayName = existing?.displayName || targetUserInfoRef.current?.displayName || 'User';
                const avatarUrl = existing?.avatarUrl || targetUserInfoRef.current?.avatarUrl;

                updated.set(peerId, {
                    odId: peerId,
                    displayName,
                    avatarUrl,
                    isMuted: existing?.isMuted ?? false,
                    isDeafened: existing?.isDeafened ?? false,
                    isVideoOn: liveVideoTracks.length > 0,
                    isScreenSharing: existing?.isScreenSharing ?? false, // Preserve screen share state
                    isSpeaking: false,
                    stream: newStream, // Always new stream object
                    cameraStream: liveVideoTracks.length > 0 ? newStream : existing?.cameraStream,
                    screenStream: existing?.screenStream, // Preserve screen share stream
                });

                console.log('[WebRTC] Updated participant:', peerId,
                    'audio:', liveAudioTracks.length, 'video:', liveVideoTracks.length,
                    'isScreenSharing:', existing?.isScreenSharing ?? false,
                    'tracks:', newStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`).join(', '));

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
                        (pc.connectionState === 'connected' || pc.connectionState === 'connecting');

                    if (isRenegotiation) {
                        console.log('[WebRTC] Handling renegotiation offer from:', peerId, 'connectionState:', pc.connectionState);
                        // For renegotiation, we accept offers even when established
                    } else if (establishedConnectionsRef.current.has(peerId) && pc.connectionState === 'connected') {
                        // Already connected and not a renegotiation - this shouldn't happen
                        console.log('[WebRTC] Unexpected offer on established connection:', peerId);
                    }

                    // Update participant state with info from signal if available
                    if (signal.userInfo) {
                        setParticipants(prev => {
                            const updated = new Map(prev);
                            const existing = updated.get(peerId);

                            // Initialize default participant structure if not exists
                            // This ensures we show the name even before tracks arrive
                            if (!existing) {
                                // We don't have tracks yet, but we can set up the placeholder
                                updated.set(peerId, {
                                    odId: peerId,
                                    displayName: signal.userInfo!.displayName || 'User',
                                    avatarUrl: signal.userInfo!.avatarUrl,
                                    isMuted: signal.userInfo!.isMuted ?? false,
                                    isDeafened: signal.userInfo!.isDeafened ?? false,
                                    isVideoOn: false,
                                    isScreenSharing: false,
                                    isSpeaking: false,
                                    stream: new MediaStream(), // Empty stream for now
                                });
                            } else {
                                updated.set(peerId, {
                                    ...existing,
                                    displayName: signal.userInfo!.displayName || existing.displayName,
                                    avatarUrl: signal.userInfo!.avatarUrl || existing.avatarUrl,
                                    // Update state if provided, otherwise keep existing
                                    isMuted: signal.userInfo!.isMuted ?? existing.isMuted,
                                    isDeafened: signal.userInfo!.isDeafened ?? existing.isDeafened,
                                });
                            }
                            return updated;
                        });
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
                    } else if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
                        // Only skip if we're in an unexpected state
                        if (!isRenegotiation) {
                            console.log('[WebRTC] Ignoring offer, signaling state is:', pc.signalingState);
                            break;
                        }
                    }

                    const stream = localStreamRef.current;
                    if (stream) {
                        // Add all tracks that don't already have a sender
                        // Get fresh list of senders each time to avoid duplicate adds
                        stream.getTracks().forEach((track) => {
                            const currentSenders = pc.getSenders();
                            const hasSender = currentSenders.some(s => s.track?.id === track.id);
                            if (!hasSender) {
                                console.log('[WebRTC] Adding local track to PC:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
                                pc.addTrack(track, stream);
                            }
                        });

                        // Verify tracks were added
                        const senders = pc.getSenders();
                        console.log('[WebRTC] PeerConnection now has', senders.length, 'senders:',
                            senders.map(s => s.track ? `${s.track.kind}:${s.track.enabled}:${s.track.id.substring(0, 8)}` : 'null').join(', '));
                    } else {
                        console.error('[WebRTC] ⚠️ CRITICAL: No local stream available when processing offer! The other peer will not receive our audio.');
                    }

                    await pc.setRemoteDescription({
                        type: 'offer',
                        sdp: signal.sdp,
                    });
                    console.log('[WebRTC] Remote description (offer) set');

                    // CRITICAL FIX: After renegotiation, check for removed video tracks
                    // This handles when remote peer stops screen share or camera
                    const receivers = pc.getReceivers();
                    const liveVideoReceivers = receivers.filter(r =>
                        r.track?.kind === 'video' && r.track?.readyState === 'live'
                    );
                    const liveAudioReceivers = receivers.filter(r =>
                        r.track?.kind === 'audio' && r.track?.readyState === 'live'
                    );

                    console.log('[WebRTC] Renegotiation receivers - audio:', liveAudioReceivers.length, 'video:', liveVideoReceivers.length);

                    // Update participant state based on current receivers
                    setParticipants((prev) => {
                        const updated = new Map(prev);
                        const existing = updated.get(peerId);

                        if (liveVideoReceivers.length === 0 && existing?.isVideoOn) {
                            // Video was removed - create new stream without video
                            console.log('[WebRTC] Video track removed during renegotiation for:', peerId);
                            const newStream = new MediaStream();

                            // Only add live audio tracks to new stream
                            liveAudioReceivers.forEach(r => {
                                if (r.track && r.track.readyState === 'live') {
                                    newStream.addTrack(r.track);
                                }
                            });

                            updated.set(peerId, {
                                ...existing,
                                stream: newStream,
                                isVideoOn: false,
                                isScreenSharing: false,
                            });
                        }

                        return updated;
                    });

                    const queuedCandidates = pendingIceCandidatesRef.current.get(peerId) || [];
                    if (queuedCandidates.length > 0) {
                        console.log('[WebRTC] Flushing', queuedCandidates.length, 'queued ICE candidates');
                        for (const candidate of queuedCandidates) {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                        pendingIceCandidatesRef.current.delete(peerId);
                    }

                    const answer = await pc.createAnswer();
                    const patchedAnswerSdp = patchSdpForOpus(answer.sdp ?? '');
                    await pc.setLocalDescription({ type: 'answer', sdp: patchedAnswerSdp });
                    console.log('[WebRTC] Local description (answer) set with Opus patch');

                    // Mark connection as established BEFORE sending answer to prevent duplicate answers
                    establishedConnectionsRef.current.add(peerId);

                    await sendSignal(peerId, 'answer', {
                        sdp: patchedAnswerSdp,
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

                    // Update participant state with info from signal if available
                    if (signal.userInfo) {
                        setParticipants(prev => {
                            const updated = new Map(prev);
                            const existing = updated.get(peerId);
                            if (existing) {
                                updated.set(peerId, {
                                    ...existing,
                                    displayName: signal.userInfo!.displayName || existing.displayName,
                                    avatarUrl: signal.userInfo!.avatarUrl || existing.avatarUrl,
                                    isMuted: signal.userInfo!.isMuted ?? existing.isMuted,
                                    isDeafened: signal.userInfo!.isDeafened ?? existing.isDeafened,
                                });
                            }
                            return updated;
                        });
                    }

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

                case 'state-update': {
                    // Handle remote participant state changes (mute, video, etc.)
                    if (signal.userState) {
                        console.log('[WebRTC] Received state-update from:', peerId, signal.userState);
                        setParticipants(prev => {
                            const updated = new Map(prev);
                            const existing = updated.get(peerId);
                            if (existing) {
                                updated.set(peerId, {
                                    ...existing,
                                    isMuted: signal.userState!.isMuted,
                                    isDeafened: signal.userState!.isDeafened,
                                    isVideoOn: signal.userState!.isVideoOn,
                                    isScreenSharing: signal.userState!.isScreenSharing,
                                });
                            }
                            return updated;
                        });
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

    // Automatically update bitrate when participant count or screen sharing changes
    useEffect(() => {
        // Only update if we have active connections
        if (peerConnectionsRef.current.size === 0) return;
        if (connectionState !== 'connected' && connectionState !== 'connecting') return;

        // Participant count includes self, so add 1
        const participantCount = participants.size + 1;

        updateBitrateConfig(participantCount, isScreenSharing);
    }, [participants.size, isScreenSharing, connectionState, updateBitrateConfig]);

    // ── Live audio settings sync ──────────────────────────────────────────────
    // When the user changes their profile/volume in settings DURING a call,
    // immediately apply the new settings to the active audio pipeline.
    useEffect(() => {
        const unsubscribe = useMediaStore.subscribe((state, prev) => {
            const pipeline = audioPipelineRef.current;
            if (!pipeline) return; // Not in a call

            // Profile changed
            if (state.inputProfile !== prev.inputProfile || state.noiseSuppressionLevel !== prev.noiseSuppressionLevel) {
                const gateThreshold =
                    state.noiseSuppressionLevel === 'krisp' ? 0.025
                        : state.noiseSuppressionLevel === 'standard' ? 0.018
                            : 0.04; // 'none' = very high threshold (barely suppresses)

                pipeline.setProfile(state.inputProfile, { noiseGateThreshold: gateThreshold });
                console.log('[AudioPipeline] Live profile update:', state.inputProfile, 'gate:', gateThreshold);
            }

            // Input volume changed
            if (state.inputVolume !== prev.inputVolume) {
                pipeline.setInputGain(state.inputVolume / 100);
                console.log('[AudioPipeline] Live volume update:', state.inputVolume);
            }
        });

        return unsubscribe;
    }, []); // Empty deps — subscribe once, pipeline ref handles the rest

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
            // Get constraints from store (using effective settings based on profile)
            const state = useMediaStore.getState();
            const effectiveSettings = state.getEffectiveAudioSettings();

            const audioConstraints = getAudioConstraints({
                deviceId: state.inputDeviceId,
                echoCancellation: effectiveSettings.echoCancellation,
                noiseSuppression: effectiveSettings.noiseSuppression,
                noiseSuppressionLevel: state.noiseSuppressionLevel,
                autoGainControl: effectiveSettings.autoGainControl,
            });

            // Initial join is audio-only — get raw mic stream
            const rawStream = await getUserMedia({
                audio: audioConstraints,
                video: false
            });

            // ── Apply audio processing pipeline ──────────────────────────────
            // Chain: mic → HighPassFilter → DynamicsCompressor → NoiseGate → WebRTC
            // This removes background noise, rumble, and keyboard clicks before
            // the audio reaches any peer — same approach as Discord's noise suppression.
            const audioPipeline = createProcessedAudioStream(
                rawStream,
                {
                    highPassFreq: 80,
                    noiseGateThreshold: 0.012,
                    compressorThreshold: -24,
                    compressorRatio: 4,
                }
            );
            // Store full pipeline controls for live settings adjustments
            audioPipelineRef.current = audioPipeline;
            // Apply initial settings from store immediately
            const mediaState = useMediaStore.getState();
            audioPipeline.setInputGain(mediaState.inputVolume / 100);
            audioPipeline.setProfile(mediaState.inputProfile, {
                noiseGateThreshold: mediaState.noiseSuppressionLevel === 'krisp' ? 0.008
                    : mediaState.noiseSuppressionLevel === 'standard' ? 0.015
                        : 0.03,
            });
            const stream = audioPipeline.processedStream;

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
                setIsSpeaking,
                // Optional: Pass sensitivity from store if VAD supports it
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
                    const patchedOfferSdp = patchSdpForOpus(offer.sdp ?? '');
                    await pc.setLocalDescription({ type: 'offer', sdp: patchedOfferSdp });

                    sentOffersRef.current.add(effectiveTargetUserId);
                    await sendSignal(effectiveTargetUserId, 'offer', {
                        sdp: patchedOfferSdp,
                    });

                    console.log('[WebRTC] Offer sent to:', effectiveTargetUserId);
                } else {
                    const pc = createPeerConnection();

                    stream.getTracks().forEach((track) => {
                        pc.addTrack(track, stream);
                    });

                    setupPeerConnection(pc, 'all');

                    const offer = await pc.createOffer();
                    const patchedSdp = patchSdpForOpus(offer.sdp ?? '');
                    await pc.setLocalDescription({ type: 'offer', sdp: patchedSdp });

                    await sendSignal('all', 'offer', {
                        sdp: patchedSdp,
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

        // Tear down the audio processing pipeline (noise gate, compressor, AudioContext)
        audioPipelineRef.current?.cleanup();
        audioPipelineRef.current = null;

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
            const newMutedState = !isMuted;
            audioTrack.enabled = !newMutedState; // enabled = true when NOT muted
            setIsMuted(newMutedState);

            console.log('[WebRTC] toggleMute: muted =', newMutedState, 'audioTrack.enabled =', audioTrack.enabled);

            // Broadcast new state
            broadcastState({
                isMuted: newMutedState,
                isDeafened: isDeafened,
                isVideoOn: isVideoOn,
                isScreenSharing: isScreenSharing
            });
        }
    }, [isMuted, isDeafened, isVideoOn, isScreenSharing, broadcastState]);

    const toggleDeafen = useCallback(() => {
        const newDeafenedState = !isDeafened;
        setIsDeafened(newDeafenedState);

        // Broadcast new state
        broadcastState({
            isMuted: isMuted,
            isDeafened: newDeafenedState,
            isVideoOn: isVideoOn,
            isScreenSharing: isScreenSharing
        });

        // Also mute mic when deafened (Discord behavior)
        if (newDeafenedState && !isMuted) {
            toggleMute();
        }

        // Mute all remote audio tracks
        participants.forEach(p => {
            if (p.stream) {
                p.stream.getAudioTracks().forEach(t => {
                    t.enabled = !newDeafenedState;
                });
            }
        });
    }, [isDeafened, isMuted, isVideoOn, isScreenSharing, broadcastState, participants, toggleMute]);

    const toggleVideo = useCallback(async () => {
        const stream = localStreamRef.current;
        if (!stream) return;

        if (isVideoOn) {
            // ── Notify peers FIRST so their UI updates immediately ──────────
            // Without this, the remote side keeps showing a frozen/blank card
            // because it doesn't know video was turned off until renegotiation
            // completes (which can take 200-500ms).
            await broadcastState({
                isMuted: isMuted,
                isDeafened: isDeafened,
                isVideoOn: false,
                isScreenSharing: isScreenSharing,
            });

            stream.getVideoTracks().forEach((track) => {
                track.stop();
                stream.removeTrack(track);
            });

            // Remove video senders from all peer connections AND renegotiate
            for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
                pc.getSenders().forEach((sender) => {
                    if (sender.track?.kind === 'video') {
                        pc.removeTrack(sender);
                        console.log('[WebRTC] Removed video track from peer:', peerId);
                    }
                });

                // Renegotiate to clean up the track on the remote side
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await sendSignal(peerId, 'offer', { sdp: offer.sdp });
                    console.log('[WebRTC] Sent renegotiation offer for video off to:', peerId);
                } catch (err) {
                    console.error('[WebRTC] Failed to renegotiate for video off:', err);
                }
            }

            setIsVideoOn(false);
        } else {
            try {
                const { videoDeviceId } = useMediaStore.getState();
                const videoConstraints = getVideoConstraints(videoDeviceId);

                const videoStream = await getUserMedia({
                    audio: true,
                    video: videoConstraints
                });

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

                // Notify peers that video is now on
                await broadcastState({
                    isMuted: isMuted,
                    isDeafened: isDeafened,
                    isVideoOn: true,
                    isScreenSharing: isScreenSharing,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to start video';
                setError(message);
            }
        }
    }, [isVideoOn, isMuted, isDeafened, isScreenSharing, sendSignal, broadcastState]);

    const stopScreenShare = useCallback(async () => {
        if (!screenStream) return;

        console.log('[WebRTC] Stopping screen share...');

        // ── Notify peers FIRST so their UI updates immediately ──────────────
        // This tells the remote side to show the profile picture fallback
        // before the SDP renegotiation even starts.
        await broadcastState({
            isMuted: isMuted,
            isDeafened: isDeafened,
            isVideoOn: isVideoOn,
            isScreenSharing: false,
        });

        const screenTracks = screenStream.getTracks();

        // Remove screen share tracks from all peer connections
        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            const sendersToRemove: RTCRtpSender[] = [];

            pc.getSenders().forEach((sender) => {
                if (sender.track && screenTracks.includes(sender.track)) {
                    sendersToRemove.push(sender);
                }
            });

            sendersToRemove.forEach((sender) => {
                pc.removeTrack(sender);
                console.log('[WebRTC] Removed screen track from peer connection:', peerId);
            });

            // Verify and restore the microphone audio track
            const localAudioTrack = localStreamRef.current?.getAudioTracks()[0];
            if (localAudioTrack && localStreamRef.current) {
                const audioSenders = pc.getSenders().filter(s => s.track?.kind === 'audio' && s.track?.id === localAudioTrack.id);

                if (audioSenders.length === 0) {
                    console.log('[WebRTC] Re-adding local audio track after screen share stop');
                    pc.addTrack(localAudioTrack, localStreamRef.current);
                } else {
                    console.log('[WebRTC] Local audio track still present after screen share stop');
                }

                if (!isMuted) {
                    localAudioTrack.enabled = true;
                    console.log('[WebRTC] Ensured local audio track is enabled');
                }
            }

            // Renegotiate to clean up the track on the remote side
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await sendSignal(peerId, 'offer', { sdp: offer.sdp });
                console.log('[WebRTC] Sent renegotiation offer after screen share stop to:', peerId);
            } catch (err) {
                console.error('[WebRTC] Failed to renegotiate after screen share stop:', err);
            }
        }

        // Clean up audio check interval
        screenTracks.forEach((track) => {
            const trackWithInterval = track as MediaStreamTrack & { _audioCheckInterval?: ReturnType<typeof setInterval> };
            if (trackWithInterval._audioCheckInterval) {
                clearInterval(trackWithInterval._audioCheckInterval);
            }
            track.stop();
        });

        // Clean up Cinema Mode audio mixer
        if (audioMixerContextRef.current) {
            try {
                audioMixerContextRef.current.close();
                console.log('[WebRTC] 🎬 Cinema Mode audio mixer cleaned up');
            } catch {
                // Ignore errors during cleanup
            }
            audioMixerContextRef.current = null;
            mixedAudioStreamRef.current = null;
            micGainNodeRef.current = null;
            systemGainNodeRef.current = null;
        }

        setScreenStream(null);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        console.log('[WebRTC] Screen share stopped successfully');
    }, [screenStream, isMuted, isDeafened, isVideoOn, sendSignal, broadcastState]);

    const startScreenShare = useCallback(async () => {
        // CRITICAL: Use synchronous ref guard to prevent rapid clicks
        if (isScreenSharing || isScreenSharingRef.current) {
            console.log('[WebRTC] Screen share already in progress, ignoring');
            return;
        }
        isScreenSharingRef.current = true;

        try {
            const stream = await getDisplayMedia();
            setScreenStream(stream);
            setIsScreenSharing(true);
            console.log('[WebRTC] Screen share stream obtained, tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`).join(', '));

            // Get the screen video track
            const screenVideoTrack = stream.getVideoTracks()[0];
            // Get screen audio track if available (system audio)
            const screenAudioTrack = stream.getAudioTracks()[0];

            // CINEMA MODE: Mix microphone + system audio for immersive screen sharing
            // When both mic and system audio are available, merge them so peers hear:
            // - Your voice commentary
            // - The game/movie/video audio
            let mixedAudioTrack: MediaStreamTrack | null = null;
            const localAudioTrack = localStreamRef.current?.getAudioTracks()[0];

            if (screenAudioTrack && localAudioTrack && !isMuted) {
                try {
                    console.log('[WebRTC] 🎬 Cinema Mode: Mixing mic + system audio');

                    // Clean up previous mixer if exists
                    if (audioMixerContextRef.current) {
                        await audioMixerContextRef.current.close().catch(() => { });
                    }

                    // Create AudioContext for mixing
                    const audioContext = new AudioContext();
                    audioMixerContextRef.current = audioContext;

                    // Create destination (output)
                    const destination = audioContext.createMediaStreamDestination();

                    // Create gain nodes for volume control
                    const micGain = audioContext.createGain();
                    const systemGain = audioContext.createGain();
                    micGainNodeRef.current = micGain;
                    systemGainNodeRef.current = systemGain;

                    // Set initial volumes (mic slightly louder for clear voice)
                    micGain.gain.value = 1.0;
                    systemGain.gain.value = 0.8; // System audio slightly quieter

                    // Create sources from both audio streams
                    const micStream = new MediaStream([localAudioTrack]);
                    const systemStream = new MediaStream([screenAudioTrack]);

                    const micSource = audioContext.createMediaStreamSource(micStream);
                    const systemSource = audioContext.createMediaStreamSource(systemStream);

                    // Connect: sources -> gains -> destination
                    micSource.connect(micGain);
                    systemSource.connect(systemGain);
                    micGain.connect(destination);
                    systemGain.connect(destination);

                    // Get the mixed output track
                    mixedAudioStreamRef.current = destination.stream;
                    mixedAudioTrack = destination.stream.getAudioTracks()[0];

                    console.log('[WebRTC] 🎬 Cinema Mode audio mixer created:', {
                        micTrack: localAudioTrack.label,
                        systemTrack: screenAudioTrack.label,
                        mixedTrack: mixedAudioTrack?.id?.substring(0, 8),
                    });
                } catch (err) {
                    console.error('[WebRTC] Failed to create audio mixer, falling back to separate tracks:', err);
                    mixedAudioTrack = null;
                }
            }

            // CRITICAL: Notify all peers BEFORE renegotiation so that when
            // ontrack fires on their side, isScreenSharing is already true.
            // This is the primary signal used by the screen share detection logic.
            // Also populate the ref as a race-condition fallback (in case offer arrives before state-update).
            for (const peerId of peerConnectionsRef.current.keys()) {
                pendingScreenSharePeersRef.current.add(peerId);
            }
            await broadcastState({
                isMuted: isMuted,
                isDeafened: isDeafened,
                isVideoOn: isVideoOn,
                isScreenSharing: true,
            });
            console.log('[WebRTC] Broadcast state-update (isScreenSharing=true) BEFORE renegotiation');

            // Add screen share tracks to all peer connections with renegotiation
            for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
                // Handle audio track - use mixed or separate based on Cinema Mode success
                if (mixedAudioTrack) {
                    // Cinema Mode: Send single mixed track
                    // First remove any existing audio senders
                    const audioSenders = pc.getSenders().filter(s => s.track?.kind === 'audio');
                    for (const sender of audioSenders) {
                        try {
                            await sender.replaceTrack(mixedAudioTrack);
                            console.log('[WebRTC] 🎬 Replaced audio with mixed track for peer:', peerId);
                        } catch {
                            // If replace fails, remove and add
                            pc.removeTrack(sender);
                            pc.addTrack(mixedAudioTrack, mixedAudioStreamRef.current!);
                            console.log('[WebRTC] 🎬 Added mixed audio track for peer:', peerId);
                        }
                    }
                    if (audioSenders.length === 0 && mixedAudioStreamRef.current) {
                        pc.addTrack(mixedAudioTrack, mixedAudioStreamRef.current);
                        console.log('[WebRTC] 🎬 Added mixed audio track (fresh) for peer:', peerId);
                    }
                } else {
                    // Fallback: Send mic and system audio as separate tracks
                    if (localAudioTrack && localStreamRef.current) {
                        const audioSenders = pc.getSenders().filter(s => s.track?.kind === 'audio');
                        const hasMicrophoneTrack = audioSenders.some(s => s.track?.id === localAudioTrack.id);

                        if (!hasMicrophoneTrack) {
                            pc.addTrack(localAudioTrack, localStreamRef.current);
                            console.log('[WebRTC] Added microphone audio track:', peerId);
                        }

                        if (!isMuted) {
                            localAudioTrack.enabled = true;
                        }
                    }

                    if (screenAudioTrack) {
                        pc.addTrack(screenAudioTrack, stream);
                        console.log('[WebRTC] Added screen audio track (system audio):', peerId);
                    }
                }

                // Remove existing video senders before adding screen share
                const allVideoSenders = pc.getSenders().filter(s => s.track?.kind === 'video' || s.track === null);
                if (allVideoSenders.length > 0) {
                    console.log('[WebRTC] Removing', allVideoSenders.length, 'existing/null senders before screen share');
                    allVideoSenders.forEach(sender => {
                        try {
                            pc.removeTrack(sender);
                        } catch (e) {
                            console.warn('[WebRTC] Failed to remove sender:', e);
                        }
                    });
                }

                // Add screen video track
                if (screenVideoTrack) {
                    pc.addTrack(screenVideoTrack, stream);
                    console.log('[WebRTC] Added screen video track:', peerId);
                }

                // CRITICAL: Verify microphone audio track is still present and enabled after adding screen tracks
                const micSenders = pc.getSenders().filter(s =>
                    s.track?.kind === 'audio' &&
                    localStreamRef.current?.getAudioTracks().some(t => t.id === s.track?.id)
                );
                if (micSenders.length > 0) {
                    micSenders.forEach(sender => {
                        if (sender.track && !isMuted) {
                            sender.track.enabled = true;
                        }
                        console.log('[WebRTC] Microphone sender verified after screen tracks:',
                            sender.track?.enabled, sender.track?.readyState);
                    });
                } else {
                    console.error('[WebRTC] ⚠️ CRITICAL: Microphone audio sender is MISSING after adding screen tracks!');
                    // Re-add the microphone track
                    if (localAudioTrack && localStreamRef.current) {
                        pc.addTrack(localAudioTrack, localStreamRef.current);
                        console.log('[WebRTC] Re-added microphone track');
                    }
                }

                await setVideoBitrate(pc, BITRATE_CONFIG.screenShare);

                // Renegotiate to inform peer about new tracks
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await sendSignal(peerId, 'offer', { sdp: offer.sdp });
                    console.log('[WebRTC] Sent renegotiation offer for screen share to:', peerId);

                    // Final verification after renegotiation
                    const allSenders = pc.getSenders();
                    console.log('[WebRTC] All senders after screen share renegotiation:',
                        allSenders.map(s => `${s.track?.kind}:${s.track?.enabled}:${s.track?.id?.substring(0, 8) || 'null'}`).join(', '));
                } catch (err) {
                    console.error('[WebRTC] Failed to renegotiate for screen share:', err);
                }
            }

            // (broadcastState already sent above, before renegotiation)

            // Handle screen share stop event
            if (screenVideoTrack) {
                screenVideoTrack.onended = () => {
                    if (import.meta.env.DEV) console.log('[WebRTC] Screen share ended by user');
                    stopScreenShare();
                };
            }

            // Start periodic audio track verification during screen share
            const audioCheckInterval = setInterval(() => {
                const localAudio = localStreamRef.current?.getAudioTracks()[0];
                if (localAudio) {
                    if (import.meta.env.DEV) {
                        console.log('[WebRTC] Screen share audio check - local track:',
                            'enabled:', localAudio.enabled,
                            'muted:', localAudio.muted,
                            'readyState:', localAudio.readyState);
                    }

                    // Ensure audio remains enabled if not muted
                    if (!localAudio.enabled && !isMuted) {
                        if (import.meta.env.DEV) console.log('[WebRTC] ⚠️ Audio track disabled during screen share, re-enabling...');
                        localAudio.enabled = true;
                    }
                } else {
                    console.warn('[WebRTC] ⚠️ No local audio track during screen share!');
                }
            }, 3000);

            // Store interval for cleanup
            (screenVideoTrack as MediaStreamTrack & { _audioCheckInterval?: ReturnType<typeof setInterval> })._audioCheckInterval = audioCheckInterval;

            setIsScreenSharing(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to share screen';
            setError(message);
        }
    }, [isScreenSharing, isMuted, isDeafened, isVideoOn, stopScreenShare, sendSignal, broadcastState]);

    // Push-to-Talk: Mute by default, enable only when key is held
    useEffect(() => {
        if (inputMode !== 'push-to-talk' || !localStream) return;

        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) return;

        // In PTT mode, start with audio disabled (muted)
        audioTrack.enabled = false;
        setIsMuted(true);

        // Also sync with peer connection senders
        const syncPeerSenders = (enabled: boolean) => {
            for (const [, pc] of peerConnectionsRef.current.entries()) {
                const audioSenders = pc.getSenders().filter(s => s.track?.kind === 'audio');
                audioSenders.forEach(sender => {
                    if (sender.track) {
                        sender.track.enabled = enabled;
                    }
                });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Match against key code (e.g., 'Space', 'KeyV', etc.)
            if (e.code === pushToTalkKey && !e.repeat) {
                audioTrack.enabled = true;
                setIsMuted(false);
                syncPeerSenders(true);
                console.log('[WebRTC] PTT: Key down - unmuted');
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === pushToTalkKey) {
                audioTrack.enabled = false;
                setIsMuted(true);
                syncPeerSenders(false);
                console.log('[WebRTC] PTT: Key up - muted');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        console.log('[WebRTC] Push-to-Talk enabled with key:', pushToTalkKey);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            // Restore normal mic state when switching away from PTT
            if (audioTrack.readyState === 'live') {
                audioTrack.enabled = true;
                setIsMuted(false);
            }
        };
    }, [inputMode, pushToTalkKey, localStream]);

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
        screenStream,
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
