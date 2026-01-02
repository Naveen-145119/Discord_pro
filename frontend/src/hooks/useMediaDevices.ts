import { useCallback, useEffect, useState } from 'react';

export interface MediaDevice {
    deviceId: string;
    label: string;
    kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

interface UseMediaDevicesReturn {
    audioInputs: MediaDevice[];
    audioOutputs: MediaDevice[];
    videoInputs: MediaDevice[];
    selectedAudioInput: string | null;
    selectedAudioOutput: string | null;
    selectedVideoInput: string | null;
    hasAudioPermission: boolean;
    hasVideoPermission: boolean;
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

            setSelectedAudioInput(prev => {
                if (prev) return prev;
                return inputs.length > 0 ? inputs[0].deviceId : null;
            });

            setSelectedAudioOutput(prev => {
                if (prev) return prev;
                return outputs.length > 0 ? outputs[0].deviceId : null;
            });

            setSelectedVideoInput(prev => {
                if (prev) return prev;
                return videos.length > 0 ? videos[0].deviceId : null;
            });
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
        }
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });

            stream.getTracks().forEach((track) => track.stop());

            setHasAudioPermission(true);
            setHasVideoPermission(true);

            await refreshDevices();

            return true;
        } catch {
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

    const selectAudioInput = useCallback((deviceId: string) => {
        setSelectedAudioInput(deviceId);
    }, []);

    const selectAudioOutput = useCallback((deviceId: string) => {
        setSelectedAudioOutput(deviceId);
    }, []);

    const selectVideoInput = useCallback((deviceId: string) => {
        setSelectedVideoInput(deviceId);
    }, []);

    useEffect(() => {
        refreshDevices();

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
