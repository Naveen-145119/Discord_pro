/**
 * WebRTC Configuration and Utilities
 * Handles peer connections, media constraints, and ICE servers
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
 */

// Free STUN servers for NAT traversal (90%+ success rate)
export const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Free TURN servers for relay (fallback for symmetric NAT)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

// RTCPeerConnection configuration
export const PEER_CONNECTION_CONFIG: RTCConfiguration = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
};

// Voice call constraints (audio only)
export const VOICE_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: false,
};

// Video call constraints (1080p)
export const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 60 },
        facingMode: 'user',
    },
};

// Screen share constraints (60fps 1080p)
export const SCREEN_SHARE_CONSTRAINTS: DisplayMediaStreamOptions = {
    video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 },
    },
    audio: true, // System audio capture
};

// Bitrate settings for quality
export const BITRATE_CONFIG = {
    audio: 128_000, // 128 kbps
    videoLow: 500_000, // 500 kbps
    videoMedium: 1_500_000, // 1.5 Mbps
    videoHigh: 4_000_000, // 4 Mbps
    screenShare: 6_000_000, // 6 Mbps for 60fps
} as const;

/**
 * Signal types for WebRTC signaling via Appwrite
 */
export type SignalType = 'offer' | 'answer' | 'ice-candidate';

export interface WebRTCSignal {
    $id?: string;
    channelId: string;
    fromUserId: string;
    toUserId: string; // "all" for broadcast
    type: SignalType;
    sdp?: string; // For offer/answer
    candidate?: string; // JSON stringified ICE candidate
    expiresAt: string; // ISO timestamp
}

/**
 * Connection state for UI updates
 */
export type ConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'failed'
    | 'closed';

/**
 * Participant in a voice/video call
 */
export interface CallParticipant {
    odId: string;
    displayName: string;
    avatarUrl?: string;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    stream?: MediaStream;
}

/**
 * Creates RTCPeerConnection with proper configuration
 */
export function createPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection(PEER_CONNECTION_CONFIG);
}

/**
 * Get user media (camera/mic) with constraints
 */
export async function getUserMedia(
    video: boolean = false
): Promise<MediaStream> {
    const constraints = video ? VIDEO_CONSTRAINTS : VOICE_CONSTRAINTS;

    try {
        return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera/microphone permission denied. Please allow access in your browser settings.');
            }
            if (error.name === 'NotFoundError') {
                throw new Error('No camera or microphone found. Please connect a device and try again.');
            }
        }
        throw error;
    }
}

/**
 * Get display media for screen sharing (60fps 1080p)
 */
export async function getDisplayMedia(): Promise<MediaStream> {
    try {
        return await navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_CONSTRAINTS);
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Screen sharing permission denied.');
            }
        }
        throw error;
    }
}

/**
 * Set video sender bitrate for quality control
 */
export async function setVideoBitrate(
    peerConnection: RTCPeerConnection,
    bitrate: number
): Promise<void> {
    const senders = peerConnection.getSenders();
    const videoSender = senders.find(s => s.track?.kind === 'video');

    if (!videoSender) return;

    const params = videoSender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
    }

    params.encodings[0].maxBitrate = bitrate;
    await videoSender.setParameters(params);
}

/**
 * Create voice activity detector using AudioContext
 */
export function createVoiceActivityDetector(
    stream: MediaStream,
    onSpeakingChange: (isSpeaking: boolean) => void,
    threshold: number = 0.01
): () => void {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let isSpeaking = false;
    let animationId: number;

    const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = average / 255;

        const nowSpeaking = normalized > threshold;

        if (nowSpeaking !== isSpeaking) {
            isSpeaking = nowSpeaking;
            onSpeakingChange(isSpeaking);
        }

        animationId = requestAnimationFrame(checkAudio);
    };

    checkAudio();

    // Cleanup function
    return () => {
        cancelAnimationFrame(animationId);
        source.disconnect();
        audioContext.close();
    };
}

/**
 * Parse ICE candidate from JSON string
 */
export function parseIceCandidate(candidateJson: string): RTCIceCandidateInit | null {
    try {
        return JSON.parse(candidateJson);
    } catch {
        return null;
    }
}

/**
 * Check if WebRTC is supported
 */
export function isWebRTCSupported(): boolean {
    return !!(
        typeof navigator.mediaDevices?.getUserMedia === 'function' &&
        window.RTCPeerConnection
    );
}

/**
 * Check if screen sharing is supported
 */
export function isScreenShareSupported(): boolean {
    return !!navigator.mediaDevices?.getDisplayMedia;
}
