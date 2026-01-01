/**
 * useMediaDevices Hook
 * Manages camera/microphone enumeration and permissions
 */
import { useCallback, useEffect, useState } from 'react';

export interface MediaDevice {
    deviceId: string;
    label: string;
    kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

interface UseMediaDevicesReturn {
    // Devices
    audioInputs: MediaDevice[];
    audioOutputs: MediaDevice[];
    videoInputs: MediaDevice[];

    // Selected devices
    selectedAudioInput: string | null;
    selectedAudioOutput: string | null;
    selectedVideoInput: string | null;

    // Permissions
    hasAudioPermission: boolean;
    hasVideoPermission: boolean;

    // Actions
    selectAudioInput: (deviceId: string) => void;
    selectAudioOutput: (deviceId: string) => void;
    selectVideoInput: (deviceId: string) => void;
    requestPermissions: () => Promise<boolean>;
    refreshDevices: () => Promise<void>;
}

export function useMediaDevices(): UseMediaDevicesReturn {
    const [audioInputs, setAudioInputs] = useState<MediaDevice[]>([]);
    const [audioOutputs, setAudioOutputs] = useState<MediaDevice[]>([]);
    const [videoInputs, setVideoInputs] = useState<MediaDevice[]>([]);

    const [selectedAudioInput, setSelectedAudioInput] = useState<string | null>(null);
    const [selectedAudioOutput, setSelectedAudioOutput] = useState<string | null>(null);
    const [selectedVideoInput, setSelectedVideoInput] = useState<string | null>(null);

    const [hasAudioPermission, setHasAudioPermission] = useState(false);
    const [hasVideoPermission, setHasVideoPermission] = useState(false);

    /**
     * Enumerate available devices
     */
    const refreshDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            const inputs: MediaDevice[] = [];
            const outputs: MediaDevice[] = [];
            const videos: MediaDevice[] = [];

            devices.forEach((device) => {
                const mediaDevice: MediaDevice = {
                    deviceId: device.deviceId,
                    label: device.label || `${device.kind} ${device.deviceId.substring(0, 8)}`,
                    kind: device.kind as MediaDevice['kind'],
                };

                switch (device.kind) {
                    case 'audioinput':
                        inputs.push(mediaDevice);
                        break;
                    case 'audiooutput':
                        outputs.push(mediaDevice);
                        break;
                    case 'videoinput':
                        videos.push(mediaDevice);
                        break;
                }
            });

            setAudioInputs(inputs);
            setAudioOutputs(outputs);
            setVideoInputs(videos);

            // Auto-select first device if none selected
            if (!selectedAudioInput && inputs.length > 0) {
                setSelectedAudioInput(inputs[0].deviceId);
            }
            if (!selectedAudioOutput && outputs.length > 0) {
                setSelectedAudioOutput(outputs[0].deviceId);
            }
            if (!selectedVideoInput && videos.length > 0) {
                setSelectedVideoInput(videos[0].deviceId);
            }
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
        }
    }, [selectedAudioInput, selectedAudioOutput, selectedVideoInput]);

    /**
     * Request camera/microphone permissions
     */
    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });

            // Stop tracks immediately (we just want permission)
            stream.getTracks().forEach((track) => track.stop());

            setHasAudioPermission(true);
            setHasVideoPermission(true);

            // Refresh devices now that we have permission (labels will be visible)
            await refreshDevices();

            return true;
        } catch (error) {
            // Try audio only
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                audioStream.getTracks().forEach((track) => track.stop());
                setHasAudioPermission(true);
                await refreshDevices();
            } catch {
                setHasAudioPermission(false);
            }

            setHasVideoPermission(false);
            return false;
        }
    }, [refreshDevices]);

    /**
     * Select audio input device
     */
    const selectAudioInput = useCallback((deviceId: string) => {
        setSelectedAudioInput(deviceId);
    }, []);

    /**
     * Select audio output device
     */
    const selectAudioOutput = useCallback((deviceId: string) => {
        setSelectedAudioOutput(deviceId);
    }, []);

    /**
     * Select video input device
     */
    const selectVideoInput = useCallback((deviceId: string) => {
        setSelectedVideoInput(deviceId);
    }, []);

    // Initial device enumeration
    useEffect(() => {
        refreshDevices();

        // Listen for device changes
        const handleDeviceChange = () => {
            refreshDevices();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [refreshDevices]);

    return {
        audioInputs,
        audioOutputs,
        videoInputs,
        selectedAudioInput,
        selectedAudioOutput,
        selectedVideoInput,
        hasAudioPermission,
        hasVideoPermission,
        selectAudioInput,
        selectAudioOutput,
        selectVideoInput,
        requestPermissions,
        refreshDevices,
    };
}
