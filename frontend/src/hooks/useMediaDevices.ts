/**
 * useMediaDevices - Hook for managing audio/video device selection
 * 
 * Provides:
 * - List of available microphones, speakers, cameras
 * - Selected device state
 * - Permission management
 * - Device hot-plugging support
 */

import { useCallback, useEffect, useState } from 'react';

export interface MediaDevice {
    deviceId: string;
    label: string;
    kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

interface UseMediaDevicesReturn {
    // Device lists
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
            setSelectedAudioInput(prev => prev ?? (inputs[0]?.deviceId ?? null));
            setSelectedAudioOutput(prev => prev ?? (outputs[0]?.deviceId ?? null));
            setSelectedVideoInput(prev => prev ?? (videos[0]?.deviceId ?? null));
        } catch (error) {
            console.error('[useMediaDevices] Failed to enumerate devices:', error);
        }
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            // Try to get both audio and video
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });

            stream.getTracks().forEach(track => track.stop());
            setHasAudioPermission(true);
            setHasVideoPermission(true);
            await refreshDevices();
            return true;
        } catch {
            // Fall back to audio only
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream.getTracks().forEach(track => track.stop());
                setHasAudioPermission(true);
                await refreshDevices();
            } catch {
                setHasAudioPermission(false);
            }
            setHasVideoPermission(false);
            return false;
        }
    }, [refreshDevices]);

    // Device change listener
    useEffect(() => {
        refreshDevices();

        const handleDeviceChange = () => refreshDevices();
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
        selectAudioInput: setSelectedAudioInput,
        selectAudioOutput: setSelectedAudioOutput,
        selectVideoInput: setSelectedVideoInput,
        requestPermissions,
        refreshDevices,
    };
}

/**
 * Helper function to replace a track in a peer connection
 * Used for hot-swapping devices without dropping the call
 */
export async function replaceTrackInConnection(
    pc: RTCPeerConnection,
    newTrack: MediaStreamTrack,
    oldTrackId?: string
): Promise<boolean> {
    const senders = pc.getSenders();
    const targetSender = senders.find(s =>
        s.track?.kind === newTrack.kind &&
        (oldTrackId ? s.track?.id === oldTrackId : true)
    );

    if (targetSender) {
        try {
            await targetSender.replaceTrack(newTrack);
            console.log('[useMediaDevices] Replaced track:', newTrack.kind, newTrack.label);
            return true;
        } catch (err) {
            console.error('[useMediaDevices] Failed to replace track:', err);
            return false;
        }
    }

    console.warn('[useMediaDevices] No matching sender found for track:', newTrack.kind);
    return false;
}

/**
 * Set audio output device on an HTMLMediaElement (for speaker selection)
 * Note: setSinkId is not supported in all browsers
 */
export async function setAudioOutputDevice(
    element: HTMLMediaElement,
    deviceId: string
): Promise<boolean> {
    // Check if setSinkId is supported
    if (!('setSinkId' in element)) {
        console.warn('[useMediaDevices] setSinkId not supported in this browser');
        return false;
    }

    try {
        await (element as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
        console.log('[useMediaDevices] Set audio output to:', deviceId);
        return true;
    } catch (err) {
        console.error('[useMediaDevices] Failed to set audio output:', err);
        return false;
    }
}

/**
 * Get a new MediaStreamTrack from a specific device
 * Used when hot-swapping to a different device
 */
export async function getTrackFromDevice(
    kind: 'audio' | 'video',
    deviceId: string
): Promise<MediaStreamTrack | null> {
    try {
        const constraints: MediaStreamConstraints = kind === 'audio'
            ? {
                audio: {
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            }
            : {
                audio: false,
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                },
            };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

        console.log('[useMediaDevices] Got new track from device:', deviceId, track?.label);
        return track || null;
    } catch (err) {
        console.error('[useMediaDevices] Failed to get track from device:', deviceId, err);
        return null;
    }
}
