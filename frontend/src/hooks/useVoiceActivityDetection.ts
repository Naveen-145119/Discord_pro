/**
 * useVoiceActivityDetection - Hook for real-time microphone level monitoring and VAD
 * 
 * Uses Web Audio API to:
 * - Monitor audio input levels for visualization
 * - Detect voice activity based on sensitivity threshold
 * - Support auto-sensitivity mode
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVADReturn {
    /** Current audio level from 0-100 for UI visualization */
    audioLevel: number;
    /** Whether user is currently speaking (based on threshold) */
    isSpeaking: boolean;
    /** Start monitoring a media stream */
    startMonitoring: (stream: MediaStream) => void;
    /** Stop monitoring and cleanup */
    stopMonitoring: () => void;
    /** Whether monitoring is active */
    isMonitoring: boolean;
}

/**
 * Voice Activity Detection hook
 * @param sensitivity - Threshold in dB (-100 to 0). Lower = more sensitive.
 * @param autoSensitivity - When true, automatically adjusts threshold based on ambient noise
 */
export function useVoiceActivityDetection(
    sensitivity: number = -50,
    autoSensitivity: boolean = true
): UseVADReturn {
    const [audioLevel, setAudioLevel] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);

    // Refs for Web Audio API
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Auto-sensitivity calibration
    const ambientNoiseFloorRef = useRef<number>(0);
    const calibrationSamplesRef = useRef<number[]>([]);
    const isCalibrationCompleteRef = useRef(false);

    // Smoothing for audio level (prevents jitter)
    const smoothedLevelRef = useRef<number>(0);
    const SMOOTHING_FACTOR = 0.3;

    // Debounce for speaking state
    const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const SPEAKING_DEBOUNCE_MS = 150;

    const cleanup = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
            speakingTimeoutRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // Reset calibration
        calibrationSamplesRef.current = [];
        isCalibrationCompleteRef.current = false;
        ambientNoiseFloorRef.current = 0;

        setAudioLevel(0);
        setIsSpeaking(false);
        setIsMonitoring(false);
    }, []);

    const startMonitoring = useCallback((stream: MediaStream) => {
        // Cleanup any existing monitoring
        cleanup();

        try {
            // Create audio context and analyser
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

            // Configure analyser
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.5;

            // Connect source to analyser (don't connect to destination - we don't want to hear ourselves)
            sourceRef.current.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

            const checkAudioLevel = () => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);

                // Calculate RMS (root mean square) for more accurate level
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sum / dataArray.length);
                const normalizedLevel = Math.min(100, (rms / 128) * 100);

                // Apply smoothing
                smoothedLevelRef.current =
                    smoothedLevelRef.current * (1 - SMOOTHING_FACTOR) +
                    normalizedLevel * SMOOTHING_FACTOR;

                setAudioLevel(Math.round(smoothedLevelRef.current));

                // Auto-sensitivity calibration (first 500ms)
                if (autoSensitivity && !isCalibrationCompleteRef.current) {
                    calibrationSamplesRef.current.push(normalizedLevel);
                    if (calibrationSamplesRef.current.length >= 30) { // ~500ms at 60fps
                        // Calculate noise floor as average of calibration samples
                        const avgNoise = calibrationSamplesRef.current.reduce((a, b) => a + b, 0)
                            / calibrationSamplesRef.current.length;
                        ambientNoiseFloorRef.current = avgNoise + 10; // Add buffer above noise floor
                        isCalibrationCompleteRef.current = true;
                        console.log('[VAD] Calibrated noise floor:', ambientNoiseFloorRef.current.toFixed(1));
                    }
                }

                // Determine speaking state
                let threshold: number;
                if (autoSensitivity && isCalibrationCompleteRef.current) {
                    threshold = ambientNoiseFloorRef.current;
                } else {
                    // Convert dB sensitivity (-100 to 0) to level (0 to 100)
                    // -100dB = very sensitive (threshold ~5), 0dB = not sensitive (threshold ~95)
                    threshold = Math.max(5, 100 + sensitivity);
                }

                const nowSpeaking = smoothedLevelRef.current > threshold;

                if (nowSpeaking) {
                    // Immediately set speaking to true
                    if (speakingTimeoutRef.current) {
                        clearTimeout(speakingTimeoutRef.current);
                        speakingTimeoutRef.current = null;
                    }
                    setIsSpeaking(true);
                } else if (!speakingTimeoutRef.current) {
                    // Debounce the transition to not speaking
                    speakingTimeoutRef.current = setTimeout(() => {
                        setIsSpeaking(false);
                        speakingTimeoutRef.current = null;
                    }, SPEAKING_DEBOUNCE_MS);
                }

                animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
            };

            // Resume audio context if suspended
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            setIsMonitoring(true);
            checkAudioLevel();

        } catch (err) {
            console.error('[VAD] Failed to start monitoring:', err);
            cleanup();
        }
    }, [autoSensitivity, sensitivity, cleanup]);

    const stopMonitoring = useCallback(() => {
        cleanup();
    }, [cleanup]);

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return {
        audioLevel,
        isSpeaking,
        startMonitoring,
        stopMonitoring,
        isMonitoring,
    };
}

/**
 * Simplified hook for just getting audio levels (for settings visualization)
 */
export function useAudioLevelMonitor() {
    const [audioLevel, setAudioLevel] = useState(0);
    const [isMonitoring, setIsMonitoring] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startMonitoring = useCallback(async (deviceId?: string) => {
        try {
            // Get audio stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: deviceId && deviceId !== 'default'
                    ? { deviceId: { exact: deviceId } }
                    : true,
                video: false,
            });

            streamRef.current = stream;

            // Create audio context
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.5;
            sourceRef.current.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            let smoothedLevel = 0;

            const checkLevel = () => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sum / dataArray.length);
                const level = Math.min(100, (rms / 128) * 100);

                smoothedLevel = smoothedLevel * 0.7 + level * 0.3;
                setAudioLevel(Math.round(smoothedLevel));

                animationFrameRef.current = requestAnimationFrame(checkLevel);
            };

            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            setIsMonitoring(true);
            checkLevel();

        } catch (err) {
            console.error('[AudioLevelMonitor] Failed to start:', err);
        }
    }, []);

    const stopMonitoring = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        setAudioLevel(0);
        setIsMonitoring(false);
    }, []);

    useEffect(() => {
        return stopMonitoring;
    }, [stopMonitoring]);

    return {
        audioLevel,
        isMonitoring,
        startMonitoring,
        stopMonitoring,
    };
}
