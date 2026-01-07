import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InputProfile = 'voice-isolation' | 'studio' | 'custom';
export type NoiseSuppressionLevel = 'krisp' | 'standard' | 'none';

export interface MediaSettings {
    inputDeviceId: string;
    outputDeviceId: string;
    videoDeviceId: string;

    // Input Profile (determines which processing options are used)
    inputProfile: InputProfile;

    // Voice Processing
    echoCancellation: boolean;
    noiseSuppression: boolean;
    noiseSuppressionLevel: NoiseSuppressionLevel;
    autoGainControl: boolean;

    // Volume & Sensitivity
    inputVolume: number; // 0-200
    outputVolume: number; // 0-200
    vadSensitivity: number; // -100 to 0 (dB)
    autoSensitivity: boolean; // Auto-detect sensitivity

    // Input Mode
    inputMode: 'voice-activity' | 'push-to-talk';
    pushToTalkKey: string;
}

interface MediaState extends MediaSettings {
    setInputDeviceId: (id: string) => void;
    setOutputDeviceId: (id: string) => void;
    setVideoDeviceId: (id: string) => void;

    setInputProfile: (profile: InputProfile) => void;

    setEchoCancellation: (enabled: boolean) => void;
    setNoiseSuppression: (enabled: boolean) => void;
    setNoiseSuppressionLevel: (level: NoiseSuppressionLevel) => void;
    setAutoGainControl: (enabled: boolean) => void;

    setInputVolume: (volume: number) => void;
    setOutputVolume: (volume: number) => void;
    setVadSensitivity: (sensitivity: number) => void;
    setAutoSensitivity: (auto: boolean) => void;

    setInputMode: (mode: 'voice-activity' | 'push-to-talk') => void;
    setPushToTalkKey: (key: string) => void;

    // Helper to get effective audio settings based on profile
    getEffectiveAudioSettings: () => {
        echoCancellation: boolean;
        noiseSuppression: boolean;
        autoGainControl: boolean;
    };
}

export const useMediaStore = create<MediaState>()(
    persist(
        (set, get) => ({
            inputDeviceId: 'default',
            outputDeviceId: 'default',
            videoDeviceId: 'default',

            inputProfile: 'custom',

            echoCancellation: true,
            noiseSuppression: true,
            noiseSuppressionLevel: 'standard',
            autoGainControl: true,

            inputVolume: 100,
            outputVolume: 100,
            vadSensitivity: -50,
            autoSensitivity: true,

            inputMode: 'voice-activity',
            pushToTalkKey: 'Space',

            setInputDeviceId: (id) => set({ inputDeviceId: id }),
            setOutputDeviceId: (id) => set({ outputDeviceId: id }),
            setVideoDeviceId: (id) => set({ videoDeviceId: id }),

            setInputProfile: (profile) => {
                // When changing profile, automatically adjust settings
                if (profile === 'voice-isolation') {
                    set({
                        inputProfile: profile,
                        echoCancellation: true,
                        noiseSuppression: true,
                        noiseSuppressionLevel: 'krisp',
                        autoGainControl: true,
                    });
                } else if (profile === 'studio') {
                    set({
                        inputProfile: profile,
                        echoCancellation: false,
                        noiseSuppression: false,
                        noiseSuppressionLevel: 'none',
                        autoGainControl: false,
                    });
                } else {
                    set({ inputProfile: profile });
                }
            },

            setEchoCancellation: (enabled) => set({ echoCancellation: enabled }),
            setNoiseSuppression: (enabled) => set({ noiseSuppression: enabled }),
            setNoiseSuppressionLevel: (level) => set({
                noiseSuppressionLevel: level,
                noiseSuppression: level !== 'none',
            }),
            setAutoGainControl: (enabled) => set({ autoGainControl: enabled }),

            setInputVolume: (volume) => set({ inputVolume: volume }),
            setOutputVolume: (volume) => set({ outputVolume: volume }),
            setVadSensitivity: (sensitivity) => set({ vadSensitivity: sensitivity }),
            setAutoSensitivity: (auto) => set({ autoSensitivity: auto }),

            setInputMode: (mode) => set({ inputMode: mode }),
            setPushToTalkKey: (key) => set({ pushToTalkKey: key }),

            getEffectiveAudioSettings: () => {
                const state = get();
                if (state.inputProfile === 'voice-isolation') {
                    return {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    };
                } else if (state.inputProfile === 'studio') {
                    return {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    };
                }
                // Custom profile uses individual settings
                return {
                    echoCancellation: state.echoCancellation,
                    noiseSuppression: state.noiseSuppressionLevel !== 'none',
                    autoGainControl: state.autoGainControl,
                };
            },
        }),
        {
            name: 'discord-media-settings',
        }
    )
);
