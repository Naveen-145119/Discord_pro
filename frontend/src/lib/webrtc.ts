
/**
 * ICE Server Configuration for WebRTC
 * 
 * STUN servers: Used to discover public IP address (NAT traversal)
 * TURN servers: Used as relay when direct P2P connection fails
 * 
 * Best practice: Include multiple STUN servers and at least one TURN server
 * for reliable connections across different network configurations.
 */
export const ICE_SERVERS: RTCIceServer[] = [
    // Google's public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Additional public STUN servers for redundancy
    { urls: 'stun:stun.stunprotocol.org:3478' },
    // Free TURN servers from Open Relay Project
    // Note: For production, use your own TURN servers or a service like Twilio/Xirsys
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
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

export const PEER_CONNECTION_CONFIG: RTCConfiguration = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
};

export const VOICE_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: false,
};

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

export const SCREEN_SHARE_CONSTRAINTS: DisplayMediaStreamOptions = {
    video: {
        displaySurface: 'monitor',
        frameRate: { ideal: 30, max: 60 },
        // Don't set fixed width/height - let it capture the full screen resolution
    },
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
    },
    // Prefer entire screen capture
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: 'include',
} as DisplayMediaStreamOptions;

export const BITRATE_CONFIG = {
    audio: 128_000,
    videoLow: 500_000,
    videoMedium: 1_500_000,
    videoHigh: 4_000_000,
    screenShare: 6_000_000,
} as const;

export type SignalType = 'offer' | 'answer' | 'ice-candidate';

export interface WebRTCSignal {
    $id?: string;
    channelId: string;
    fromUserId: string;
    toUserId: string;
    type: SignalType;
    sdp?: string;
    candidate?: string;
    expiresAt: string;
}

export type ConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'failed'
    | 'closed';

export interface CallParticipant {
    odId: string;
    displayName: string;
    avatarUrl?: string;
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    /** Camera stream - separate from screen share */
    cameraStream?: MediaStream;
    /** Screen share stream - creates additional card */
    screenStream?: MediaStream;
    /** @deprecated Use cameraStream instead. Kept for backward compatibility. */
    stream?: MediaStream;
}

export function createPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection(PEER_CONNECTION_CONFIG);
}


export function getAudioConstraints(settings?: {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    noiseSuppressionLevel?: 'krisp' | 'standard' | 'none';
    autoGainControl?: boolean;
    deviceId?: string;
}): MediaTrackConstraints {
    // Determine effective noise suppression based on level
    // 'krisp' and 'standard' both use browser's native noiseSuppression=true
    // 'none' disables it entirely
    const useNoiseSuppression = settings?.noiseSuppressionLevel
        ? settings.noiseSuppressionLevel !== 'none'
        : (settings?.noiseSuppression ?? true);

    const constraints: MediaTrackConstraints = {
        echoCancellation: settings?.echoCancellation ?? true,
        noiseSuppression: useNoiseSuppression,
        autoGainControl: settings?.autoGainControl ?? true,
        // Advanced Chrome-specific constraints for "crisp" audio
        // @ts-ignore - Vendor specific constraints
        googEchoCancellation: settings?.echoCancellation ?? true,
        googAutoGainControl: settings?.autoGainControl ?? true,
        googNoiseSuppression: useNoiseSuppression,
        googHighpassFilter: true,
        googTypingNoiseDetection: true, // Detects and swallows keyboard clicks
    };

    if (settings?.deviceId && settings.deviceId !== 'default') {
        constraints.deviceId = { exact: settings.deviceId };
    }

    return constraints;
}

export function getVideoConstraints(deviceId?: string): MediaTrackConstraints {
    const constraints: MediaTrackConstraints = {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 60 },
        facingMode: 'user',
    };

    if (deviceId && deviceId !== 'default') {
        constraints.deviceId = { exact: deviceId };
    }

    return constraints;
}

export async function getUserMedia(
    constraints?: MediaStreamConstraints
): Promise<MediaStream> {
    const finalConstraints = constraints || VOICE_CONSTRAINTS;

    try {
        return await navigator.mediaDevices.getUserMedia(finalConstraints);
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

    return () => {
        cancelAnimationFrame(animationId);
        source.disconnect();
        audioContext.close();
    };
}

export function parseIceCandidate(candidateJson: string): RTCIceCandidateInit | null {
    try {
        return JSON.parse(candidateJson);
    } catch {
        return null;
    }
}

export function isWebRTCSupported(): boolean {
    return !!(
        typeof navigator.mediaDevices?.getUserMedia === 'function' &&
        window.RTCPeerConnection
    );
}

export function isScreenShareSupported(): boolean {
    return !!navigator.mediaDevices?.getDisplayMedia;
}
