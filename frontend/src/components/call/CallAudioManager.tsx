import { useRef, useEffect, useCallback, useState } from 'react';
import { useMediaStore } from '@/stores/mediaStore';

interface CallAudioManagerProps {
    remoteStream: MediaStream | null;
    remoteStreamVersion: number;
}

/**
 * Manages WebRTC audio playback separately from the UI.
 * Handles Chrome audio workarounds and volume control.
 */
export function CallAudioManager({ remoteStream, remoteStreamVersion }: CallAudioManagerProps) {
    const { outputVolume: volume } = useMediaStore();
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioSetupForStreamRef = useRef<string | null>(null);

    // For Chrome WebRTC audio bug workaround - need a muted element
    const hiddenAudioRef = useRef<HTMLAudioElement>(null);

    /**
     * FIXED: WebRTC Audio with Volume Control
     * 
     * Chrome has a bug where WebRTC remote streams need special handling:
     * 1. Attach stream to a MUTED audio element (workaround for Chrome bug)
     * 2. Use createMediaStreamSource (NOT createMediaElementSource) 
     * 3. Route through GainNode for volume control
     * 4. Connect to AudioContext.destination for playback
     */
    const setupAudioWithGain = useCallback(async (stream: MediaStream, initialVolume: number) => {
        // Create unique ID for this stream
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
                    console.log('[CallAudioManager] Error cleaning up previous audio context:', e);
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
            // This "activates" the stream in Chrome without playing it directly
            const hiddenAudio = hiddenAudioRef.current;
            if (hiddenAudio) {
                hiddenAudio.srcObject = stream;
                hiddenAudio.muted = true;
                try {
                    await hiddenAudio.play();
                } catch (e) {
                    console.log('[CallAudioManager] Hidden audio play failed (may be fine):', e);
                }
            }

            // Create AudioContext for volume control
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            // Resume context if suspended (autoplay policy)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Create source from the MediaStream directly (NOT from an element)
            const audioOnlyStream = new MediaStream(audioTracks);
            const source = audioContext.createMediaStreamSource(audioOnlyStream);
            sourceNodeRef.current = source;

            // Create gain node for volume control
            const gainNode = audioContext.createGain();
            gainNodeRef.current = gainNode;
            gainNode.gain.value = initialVolume / 100;

            // Connect: source -> gain -> destination (speakers)
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            audioSetupForStreamRef.current = streamId;

            console.log('[CallAudioManager] ✅ Audio pipeline set up');
        } catch (err) {
            console.error('[CallAudioManager] Failed to setup audio:', err);
        }
    }, []);

    // Handle remote stream with gain-controlled audio
    useEffect(() => {
        if (!remoteStream) return;

        // Force audio setup reset when stream version changes
        audioSetupForStreamRef.current = null;

        setupAudioWithGain(remoteStream, volume);

        // Cleanup
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

    // Update gain when volume changes
    useEffect(() => {
        if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
            const currentTime = audioContextRef.current.currentTime;
            gainNodeRef.current.gain.cancelScheduledValues(currentTime);
            gainNodeRef.current.gain.setTargetAtTime(volume / 100, currentTime, 0.05);
        }
    }, [volume]);

    return (
        <audio
            ref={hiddenAudioRef}
            muted
            autoPlay
            playsInline
            className="hidden"
        />
    );
}
