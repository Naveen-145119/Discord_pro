import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MediaSettings {
    inputDeviceId: string;
    outputDeviceId: string;
    videoDeviceId: string;

    // Voice Processing
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;

    // Volume & Sensitivity
    inputVolume: number; // 0-200
    outputVolume: number; // 0-200
    vadSensitivity: number; // -100 to 0 (dB)

    // Input Mode
    inputMode: 'voice-activity' | 'push-to-talk';
    pushToTalkKey: string;
}

interface MediaState extends MediaSettings {
    setInputDeviceId: (id: string) => void;
    setOutputDeviceId: (id: string) => void;
    setVideoDeviceId: (id: string) => void;

    setEchoCancellation: (enabled: boolean) => void;
    setNoiseSuppression: (enabled: boolean) => void;
    setAutoGainControl: (enabled: boolean) => void;

    setInputVolume: (volume: number) => void;
    setOutputVolume: (volume: number) => void;
    setVadSensitivity: (sensitivity: number) => void;

    setInputMode: (mode: 'voice-activity' | 'push-to-talk') => void;
    setPushToTalkKey: (key: string) => void;
}

export const useMediaStore = create<MediaState>()(
    persist(
        (set) => ({
            inputDeviceId: 'default',
            outputDeviceId: 'default',
            videoDeviceId: 'default',

            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,

            inputVolume: 100,
            outputVolume: 100,
            vadSensitivity: -50,

            inputMode: 'voice-activity',
            pushToTalkKey: 'Space', // Default to Space? Usually it's a key code.

            setInputDeviceId: (id) => set({ inputDeviceId: id }),
            setOutputDeviceId: (id) => set({ outputDeviceId: id }),
            setVideoDeviceId: (id) => set({ videoDeviceId: id }),

            setEchoCancellation: (enabled) => set({ echoCancellation: enabled }),
            setNoiseSuppression: (enabled) => set({ noiseSuppression: enabled }),
            setAutoGainControl: (enabled) => set({ autoGainControl: enabled }),

            setInputVolume: (volume) => set({ inputVolume: volume }),
            setOutputVolume: (volume) => set({ outputVolume: volume }),
            setVadSensitivity: (sensitivity) => set({ vadSensitivity: sensitivity }),

            setInputMode: (mode) => set({ inputMode: mode }),
            setPushToTalkKey: (key) => set({ pushToTalkKey: key }),
        }),
        {
            name: 'discord-media-settings',
        }
    )
);
