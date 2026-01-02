import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StreamQuality = '720p' | '1080p' | 'source';

export interface StreamQualityConfig {
    width: number;
    height: number;
    frameRate: number;
    maxBitrate: number;
}

export const QUALITY_PRESETS: Record<StreamQuality, StreamQualityConfig> = {
    '720p': {
        width: 1280,
        height: 720,
        frameRate: 30,
        maxBitrate: 2_500_000, // 2.5 Mbps
    },
    '1080p': {
        width: 1920,
        height: 1080,
        frameRate: 60,
        maxBitrate: 6_000_000, // 6 Mbps
    },
    'source': {
        width: 4096,
        height: 2160,
        frameRate: 60,
        maxBitrate: 10_000_000, // 10 Mbps (uncapped-ish)
    },
};

interface StreamQualityState {
    quality: StreamQuality;
    setQuality: (quality: StreamQuality) => void;
    getConfig: () => StreamQualityConfig;
}

export const useStreamQualityStore = create<StreamQualityState>()(
    persist(
        (set, get) => ({
            quality: '720p', // Default

            setQuality: (quality) => set({ quality }),

            getConfig: () => {
                const { quality } = get();
                return QUALITY_PRESETS[quality];
            },
        }),
        {
            name: 'discord-stream-quality',
        }
    )
);
