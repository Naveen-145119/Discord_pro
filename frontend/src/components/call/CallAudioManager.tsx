import { useRef, useEffect, useCallback } from 'react';
import { useMediaStore } from '@/stores/mediaStore';

interface CallAudioManagerProps {
    remoteStream: MediaStream | null;
    remoteStreamVersion: number;
}

// Extend HTMLAudioElement type to include setSinkId (not in all TS lib versions)
interface AudioElementWithSink extends HTMLAudioElement {
    setSinkId?: (sinkId: string) => Promise<void>;
}

/**
 * Manages WebRTC audio playback separately from the UI.
 *
 * Handles:
 * - Chrome WebRTC audio bug workaround (muted element + AudioContext)
 * - Volume control via GainNode
 * - Output device routing via setSinkId (headphones vs speakers)
 */
export function CallAudioManager({ remoteStream, remoteStreamVersion }: CallAudioManagerProps) {
    const { outputVolume: volume, outputDeviceId } = useMediaStore();
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioSetupForStreamRef = useRef<string | null>(null);
    const hiddenAudioRef = useRef<AudioElementWithSink>(null);

    /**
     * Route audio to the selected output device using setSinkId.
     * This is what makes "Output Device" in settings actually work —
     * without this, audio always goes to the system default speaker.
     */
    useEffect(() => {
        const audio = hiddenAudioRef.current;
        if (!audio || typeof audio.setSinkId !== 'function') return;

        const targetDevice = outputDeviceId === 'default' ? '' : outputDeviceId;
        audio.setSinkId(targetDevice)
            .then(() => console.log('[CallAudioManager] Output device set to:', outputDeviceId))
            .catch((err: unknown) => console.warn('[CallAudioManager] setSinkId failed:', err));
    }, [outputDeviceId]);

    /**
     * Set up WebRTC audio with volume control.
     *
     * Chrome has a bug where WebRTC remote streams need special handling:
     * 1. Attach stream to a MUTED audio element (workaround for Chrome bug)
     * 2. Use createMediaStreamSource (NOT createMediaElementSource)
     * 3. Route through GainNode for volume control
     * 4. Connect to AudioContext.destination for playback
     */
    const setupAudioWithGain = useCallback(async (stream: MediaStream, initialVolume: number) => {
        const streamId = stream.id + stream.getAudioTracks().map(t => t.id).join('');

        // Skip if already set up for this exact stream
        if (audioSetupForStreamRef.current === streamId && audioContextRef.current) {
            if (gainNodeRef.current) {
                gainNodeRef.current.gain.value = initialVolume / 100;
            }
            return;
        }

        console.log('[CallAudioManager] Setting up audio for stream:', streamId.substring(0, 20));

        try {
            // Cleanup previous audio context
            if (audioContextRef.current) {
                try {
                    sourceNodeRef.current?.disconnect();
                    gainNodeRef.current?.disconnect();
                    await audioContextRef.current.close();
                } catch (e) {
                    console.log('[CallAudioManager] Error cleaning up previous context:', e);
                }
                audioContextRef.current = null;
                gainNodeRef.current = null;
                sourceNodeRef.current = null;
            }

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[CallAudioManager] No audio tracks in stream');
                return;
            }

            // CHROME WORKAROUND: Attach stream to a MUTED audio element
            const hiddenAudio = hiddenAudioRef.current;
            if (hiddenAudio) {
                hiddenAudio.srcObject = stream;
                hiddenAudio.muted = true;
                try {
                    await hiddenAudio.play();
                } catch (e) {
                    console.log('[CallAudioManager] Hidden audio play failed (may be fine):', e);
                }
                // Apply output device routing immediately after setup
                const sinkId = outputDeviceId === 'default' ? '' : outputDeviceId;
                if (typeof hiddenAudio.setSinkId === 'function') {
                    hiddenAudio.setSinkId(sinkId).catch(() => { });
                }
            }

            // Create AudioContext for volume control
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const audioOnlyStream = new MediaStream(audioTracks);
            const source = audioContext.createMediaStreamSource(audioOnlyStream);
            sourceNodeRef.current = source;

            const gainNode = audioContext.createGain();
            gainNodeRef.current = gainNode;
            gainNode.gain.value = initialVolume / 100;

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            audioSetupForStreamRef.current = streamId;

            console.log('[CallAudioManager] ✅ Audio pipeline ready');
        } catch (err) {
            console.error('[CallAudioManager] Failed to setup audio:', err);
        }
    }, [outputDeviceId]);

    // Handle remote stream changes
    useEffect(() => {
        if (!remoteStream) return;

        audioSetupForStreamRef.current = null;
        setupAudioWithGain(remoteStream, volume);

        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                sourceNodeRef.current?.disconnect();
                gainNodeRef.current?.disconnect();
                audioContextRef.current.close().catch(() => { });
                audioContextRef.current = null;
                gainNodeRef.current = null;
                sourceNodeRef.current = null;
                audioSetupForStreamRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remoteStream, remoteStreamVersion, setupAudioWithGain]);

    // Live volume updates
    useEffect(() => {
        if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
            const currentTime = audioContextRef.current.currentTime;
            gainNodeRef.current.gain.cancelScheduledValues(currentTime);
            gainNodeRef.current.gain.setTargetAtTime(volume / 100, currentTime, 0.05);
        }
    }, [volume]);

    return (
        <audio
            ref={hiddenAudioRef as React.RefObject<HTMLAudioElement>}
            muted
            autoPlay
            playsInline
            className="hidden"
        />
    );
}
