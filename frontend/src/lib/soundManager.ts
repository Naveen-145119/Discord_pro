/**
 * SoundManager - Audio feedback utility for Discord-like sounds
 * Singleton pattern to manage preloaded audio files
 */

import { useSettingsStore } from '@/stores/settingsStore';

// Sound effect types
export type SoundEffect =
    | 'message'
    | 'mention'
    | 'mute'
    | 'unmute'
    | 'deafen'
    | 'undeafen'
    | 'user_join'
    | 'user_leave'
    | 'call_ring'
    | 'call_end'
    | 'disconnect';

// Sound URLs (using free/open-source sounds - placeholder base64 or URLs)
const SOUND_URLS: Record<SoundEffect, string> = {
    // Data URLs for tiny notification sounds (generated sine waves)
    message: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQIEGH6n4ONsEwQAd7Ds6HwPBAB7tOzofREB',
    mention: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQIEGH6n4ONsEwQAd7Ds6HwPBAB7tOzofREB',
    mute: 'data:audio/wav;base64,UklGRl9vT19teleQIEGH6n4ONsEwQAdzdGF0YVlQrKywAGE0dG9uZTEUklGRl9vFRNoGAACB',
    unmute: 'data:audio/wav;base64,UklGRl9vT19teleQIEGH6n4ONsEwQAdzdGF0YVlQrKywAGE0dG9uZTEUklGRl9vFRNoGAACB',
    deafen: 'data:audio/wav;base64,UklGRl9vT19teleQIEGH6n4ONsEwQAdzdGF0YVlQrKywAGE0dG9uZTEUklGRl9vFRNoGAACB',
    undeafen: 'data:audio/wav;base64,UklGRl9vT19teleQIEGH6n4ONsEwQAdzdGF0YVlQrKywAGE0dG9uZTEUklGRl9vFRNoGAACB',
    user_join: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAE0ZGodDbq2EcBj+a2teleQIEGH6n4ONsEwQAd7Ds6HwPBAB7tOzofREB',
    user_leave: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEasdDbq2EcBj+a2teleQIEGH6n4ONsEwQAd7Ds6HwPBAB7tOzofREB',
    call_ring: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVg',
    call_end: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEzq2EcBj+a2teleQIEGH6n4ONsEwQAd7Ds6HwPBAB7tOzofREB',
    disconnect: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAE0ZGodDbq2EcBj+a2teleQIEGH6n4ONsEwQAd7Ds6HwPBAB7tOzofREB',
};

class SoundManagerClass {
    private audioElements: Map<SoundEffect, HTMLAudioElement> = new Map();
    private isInitialized = false;

    constructor() {
        // Preload sounds lazily on first interaction
        if (typeof window !== 'undefined') {
            this.preloadSounds();
        }
    }

    private preloadSounds() {
        if (this.isInitialized) return;

        Object.entries(SOUND_URLS).forEach(([key, url]) => {
            const audio = new Audio();
            audio.src = url;
            audio.preload = 'auto';
            audio.volume = 0.5;
            this.audioElements.set(key as SoundEffect, audio);
        });

        this.isInitialized = true;
    }

    /**
     * Play a sound effect
     * Respects the global sounds enabled setting
     */
    play(sound: SoundEffect, volume = 0.5) {
        // Check if sounds are enabled
        const { soundsEnabled } = useSettingsStore.getState();
        if (!soundsEnabled) return;

        this.preloadSounds(); // Ensure sounds are loaded

        const audio = this.audioElements.get(sound);
        if (!audio) return;

        // Clone the audio to allow overlapping plays
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = Math.min(1, Math.max(0, volume));

        clone.play().catch(() => {
            // Ignore autoplay errors - user interaction required
            console.debug('[SoundManager] Play blocked:', sound);
        });
    }

    /**
     * Play message notification (only if window is not focused)
     */
    playMessage() {
        if (!document.hasFocus()) {
            this.play('message', 0.4);
        }
    }

    /**
     * Toggle sounds for mute/unmute actions
     */
    playMuteToggle(isMuted: boolean) {
        this.play(isMuted ? 'mute' : 'unmute', 0.3);
    }

    /**
     * Toggle sounds for deafen actions
     */
    playDeafenToggle(isDeafened: boolean) {
        this.play(isDeafened ? 'deafen' : 'undeafen', 0.3);
    }

    /**
     * Voice channel join/leave sounds
     */
    playUserJoin() {
        this.play('user_join', 0.4);
    }

    playUserLeave() {
        this.play('user_leave', 0.4);
    }

    /**
     * Call sounds
     */
    playCallRing() {
        this.play('call_ring', 0.5);
    }

    playCallEnd() {
        this.play('call_end', 0.4);
    }

    playDisconnect() {
        this.play('disconnect', 0.4);
    }
}

// Export singleton instance
export const SoundManager = new SoundManagerClass();
