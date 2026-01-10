'use client';

import { useEffect, useState } from 'react';
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
    ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';

interface MediaRoomProps {
    chatId: string;
    video: boolean;
    audio: boolean;
    username: string;
    onLeave?: () => void;
}

// MediaRoom component using LiveKit SFU (Blueprint Section 5.3)
export function MediaRoom({
    chatId,
    video,
    audio,
    username,
    onLeave,
}: MediaRoomProps) {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const response = await fetch(
                    `/api/livekit?room=${chatId}&username=${username}`
                );

                if (!response.ok) {
                    throw new Error('Failed to get token');
                }

                const data = await response.json();
                setToken(data.token);
            } catch (err) {
                console.error('Error fetching LiveKit token:', err);
                setError('Failed to connect to voice channel');
            }
        };

        fetchToken();
    }, [chatId, username]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-[#1E1F22]">
                <div className="text-center">
                    <p className="text-[#ED4245] mb-4">{error}</p>
                    <button
                        onClick={onLeave}
                        className="btn-secondary"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="flex items-center justify-center h-full bg-[#1E1F22]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[#949BA4]">Connecting to voice...</p>
                </div>
            </div>
        );
    }

    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!serverUrl) {
        return (
            <div className="flex items-center justify-center h-full bg-[#1E1F22]">
                <p className="text-[#ED4245]">LiveKit server URL not configured</p>
            </div>
        );
    }

    return (
        <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={true}
            video={video}
            audio={audio}
            data-lk-theme="default"
            style={{ height: '100%' }}
            onDisconnected={onLeave}
        >
            {/* Video grid for video calls */}
            {video ? (
                <VideoConference />
            ) : (
                // Audio-only mode - show participants without video
                <div className="flex flex-col h-full">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#5865F2] flex items-center justify-center">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                </svg>
                            </div>
                            <p className="text-[#DBDEE1] font-medium">{username}</p>
                            <p className="text-[#57F287] text-sm">Connected</p>
                        </div>
                    </div>

                    {/* Control bar at bottom */}
                    <ControlBar variation="minimal" />
                </div>
            )}

            {/* Audio renderer - plays audio even when not visible */}
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
}
