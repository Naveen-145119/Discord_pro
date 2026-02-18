
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

/**
 * Audio Processing Pipeline — Discord-quality noise suppression
 *
 * Chain: mic → InputGain → HighPassFilter → DynamicsCompressor → NoiseGate → MediaStreamDestination
 *
 * Returns live controls so settings can be adjusted without restarting the call:
 *   - setInputGain(0–2): mic volume boost/cut
 *   - setGateThreshold(0–1): noise gate aggressiveness
 *   - setGateEnabled(bool): bypass gate entirely (Studio mode)
 *   - setProfile('voice-isolation'|'studio'|'custom'): preset profiles
 */
export interface AudioPipelineControls {
    processedStream: MediaStream;
    cleanup: () => void;
    setInputGain: (gain: number) => void;          // 0–2, 1 = 100%
    setGateThreshold: (threshold: number) => void; // 0–1 RMS
    setGateEnabled: (enabled: boolean) => void;
    setEchoCancellation: (enabled: boolean) => void; // Note: requires track restart
    setProfile: (profile: 'voice-isolation' | 'studio' | 'custom', opts?: {
        noiseGateThreshold?: number;
        autoGainControl?: boolean;
    }) => void;
}

export function createProcessedAudioStream(
    rawStream: MediaStream,
    options?: {
        highPassFreq?: number;
        noiseGateThreshold?: number;
        compressorThreshold?: number;
        compressorRatio?: number;
        inputGain?: number;
    }
): AudioPipelineControls {
    const {
        highPassFreq = 80,
        noiseGateThreshold: initialGateThreshold = 0.012,
        compressorThreshold = -24,
        compressorRatio = 4,
        inputGain: initialGain = 1.0,
    } = options ?? {};

    const audioCtx = new AudioContext({ sampleRate: 48000 });
    const source = audioCtx.createMediaStreamSource(rawStream);

    // 0. Input Gain — mic volume control (0–2x)
    const inputGainNode = audioCtx.createGain();
    inputGainNode.gain.value = initialGain;

    // 1. High-pass filter — kills rumble below 80Hz
    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = highPassFreq;
    highPass.Q.value = 0.7;

    // 2. Dynamics compressor — evens out volume, prevents clipping
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = compressorThreshold;
    compressor.knee.value = 10;
    compressor.ratio.value = compressorRatio;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // 3. Noise gate via ScriptProcessor
    const bufferSize = 2048;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const gateProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    let gateOpen = false;
    let holdCounter = 0;
    const holdSamples = Math.floor(audioCtx.sampleRate * 0.15);
    let currentGateThreshold = initialGateThreshold;
    let gateEnabled = true;

    gateProcessor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);

        if (!gateEnabled) {
            // Gate bypassed (Studio mode) — pass through raw
            for (let i = 0; i < input.length; i++) output[i] = input[i];
            return;
        }

        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);

        if (rms > currentGateThreshold) {
            gateOpen = true;
            holdCounter = holdSamples;
        } else if (holdCounter > 0) {
            holdCounter -= input.length;
        } else {
            gateOpen = false;
        }

        for (let i = 0; i < input.length; i++) {
            output[i] = gateOpen ? input[i] : 0;
        }
    };

    // 4. Destination
    const destination = audioCtx.createMediaStreamDestination();

    // Wire: source → inputGain → highPass → compressor → gate → destination
    source.connect(inputGainNode);
    inputGainNode.connect(highPass);
    highPass.connect(compressor);
    compressor.connect(gateProcessor);
    gateProcessor.connect(destination);

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }

    const cleanup = () => {
        try {
            source.disconnect();
            inputGainNode.disconnect();
            highPass.disconnect();
            compressor.disconnect();
            gateProcessor.disconnect();
            destination.disconnect();
            audioCtx.close();
        } catch { /* ignore */ }
    };

    return {
        processedStream: destination.stream,
        cleanup,
        setInputGain: (gain: number) => {
            inputGainNode.gain.setTargetAtTime(gain, audioCtx.currentTime, 0.05);
        },
        setGateThreshold: (threshold: number) => {
            currentGateThreshold = threshold;
        },
        setGateEnabled: (enabled: boolean) => {
            gateEnabled = enabled;
            if (!enabled) { gateOpen = false; holdCounter = 0; }
        },
        setEchoCancellation: (_enabled: boolean) => {
            // Echo cancellation is a MediaTrack constraint — requires getUserMedia restart
            // This is handled by handleDeviceChange in useWebRTC
            console.log('[AudioPipeline] Echo cancellation change requires track restart');
        },
        setProfile: (profile, opts) => {
            if (profile === 'voice-isolation') {
                // Aggressive noise gate, full processing
                gateEnabled = true;
                currentGateThreshold = 0.012;
                compressor.threshold.value = -24;
                compressor.ratio.value = 4;
            } else if (profile === 'studio') {
                // No gate, no compression — pure mic signal
                gateEnabled = false;
                compressor.threshold.value = -60; // effectively bypassed
                compressor.ratio.value = 1;
            } else {
                // Custom — use provided opts or keep current
                gateEnabled = true;
                if (opts?.noiseGateThreshold !== undefined) {
                    currentGateThreshold = opts.noiseGateThreshold;
                }
            }
        },
    };
}


/**
 * Patch SDP to force Opus codec with:
 * - 128kbps max bitrate
 * - Stereo
 * - FEC (Forward Error Correction) — recovers from packet loss
 * - DTX (Discontinuous Transmission) — saves bandwidth during silence
 * - minptime=10 — reduces latency
 */
export function patchSdpForOpus(sdp: string): string {
    // Find Opus payload type
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
    if (!opusMatch) return sdp; // No Opus found, return unchanged

    const opusPayload = opusMatch[1];
    const opusFmtpLine = `a=fmtp:${opusPayload} minptime=10;useinbandfec=1;stereo=1;maxaveragebitrate=128000;usedtx=1`;

    // Replace existing fmtp line for this payload, or insert after rtpmap
    if (sdp.includes(`a=fmtp:${opusPayload}`)) {
        return sdp.replace(
            new RegExp(`a=fmtp:${opusPayload} [^\r\n]*`),
            opusFmtpLine
        );
    } else {
        return sdp.replace(
            new RegExp(`(a=rtpmap:${opusPayload} opus\/48000\/2)`),
            `$1\r\n${opusFmtpLine}`
        );
    }
}

export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'state-update';

export interface WebRTCSignal {
    $id?: string;
    channelId: string;
    fromUserId: string;
    toUserId: string;
    type: SignalType;
    sdp?: string;
    candidate?: string;
    expiresAt: string;
    userInfo?: {
        displayName: string;
        avatarUrl?: string;
        isMuted?: boolean;
        isDeafened?: boolean;
    };
    userState?: {
        isMuted: boolean;
        isDeafened: boolean;
        isVideoOn: boolean;
        isScreenSharing: boolean;
    };
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
