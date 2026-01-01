import { useState, useEffect, useCallback, useRef } from 'react';
import { databases, client, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { ID } from 'appwrite';
import { useAuthStore } from '@/stores/authStore';
import { useWebRTC } from './useWebRTC';
import type { User } from '@/types';

export type CallStatus = 'ringing' | 'answered' | 'ended' | 'declined';
export type CallType = 'voice' | 'video';

export interface ActiveCall {
    $id: string;
    callerId: string;
    receiverId: string;
    channelId: string;
    callType: CallType;
    status: CallStatus;
    caller?: User;
    receiver?: User;
}

interface UseCallReturn {
    // State
    currentCall: ActiveCall | null;
    incomingCall: ActiveCall | null;
    isInCall: boolean;
    isCalling: boolean;

    // WebRTC state (proxied from useWebRTC)
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;

    // Actions
    startCall: (friendId: string, channelId: string, callType: CallType) => Promise<void>;
    answerCall: () => Promise<void>;
    declineCall: () => Promise<void>;
    endCall: () => Promise<void>;
    toggleMute: () => void;
    toggleVideo: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
}

/**
 * Hook for managing 1:1 voice/video calls with signaling
 */
export function useCall(): UseCallReturn {
    const { user } = useAuthStore();
    const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
    const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // WebRTC hook - only initialize when in a call
    const webRTC = useWebRTC({
        channelId: currentCall?.channelId || '',
        userId: user?.$id || '',
        displayName: user?.displayName || 'User',
    });

    const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Start a call to a friend
    const startCall = useCallback(async (friendId: string, channelId: string, callType: CallType) => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            // Create call document
            const call = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.ACTIVE_CALLS,
                ID.unique(),
                {
                    callerId: user.$id,
                    receiverId: friendId,
                    channelId,
                    callType,
                    status: 'ringing'
                }
            );

            setCurrentCall(call as unknown as ActiveCall);

            // Auto-end call after 30 seconds if not answered
            callTimeoutRef.current = setTimeout(async () => {
                if (call.$id) {
                    try {
                        await databases.updateDocument(
                            DATABASE_ID,
                            COLLECTIONS.ACTIVE_CALLS,
                            call.$id,
                            { status: 'ended' }
                        );
                    } catch {
                        // Call may have already been deleted
                    }
                }
            }, 30000);

            // Join WebRTC channel
            await webRTC.joinChannel();
        } catch (err) {
            console.error('Failed to start call:', err);
            throw err;
        }
    }, [user?.$id, webRTC]);

    // Answer an incoming call
    const answerCall = useCallback(async () => {
        if (!incomingCall) return;

        try {
            // Update call status
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.ACTIVE_CALLS,
                incomingCall.$id,
                { status: 'answered' }
            );

            setCurrentCall(incomingCall);
            setIncomingCall(null);

            // Join WebRTC channel
            await webRTC.joinChannel();
        } catch (err) {
            console.error('Failed to answer call:', err);
            throw err;
        }
    }, [incomingCall, webRTC]);

    // Decline an incoming call
    const declineCall = useCallback(async () => {
        if (!incomingCall) return;

        try {
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.ACTIVE_CALLS,
                incomingCall.$id,
                { status: 'declined' }
            );

            setIncomingCall(null);
        } catch (err) {
            console.error('Failed to decline call:', err);
        }
    }, [incomingCall]);

    // End the current call
    const endCall = useCallback(async () => {
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }

        if (currentCall) {
            try {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACTIVE_CALLS,
                    currentCall.$id,
                    { status: 'ended' }
                );
            } catch {
                // Call may have already been deleted
            }
        }

        webRTC.leaveChannel();
        setCurrentCall(null);
        setRemoteStream(null);
    }, [currentCall, webRTC]);

    // Toggle screen share with 1080p 60fps
    const toggleScreenShare = useCallback(async () => {
        if (webRTC.isScreenSharing) {
            webRTC.stopScreenShare();
        } else {
            await webRTC.startScreenShare();
        }
    }, [webRTC]);

    // Subscribe to incoming calls
    useEffect(() => {
        if (!user?.$id) return;

        // Subscribe to calls where user is the receiver
        const unsubscribe = client.subscribe(
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.ACTIVE_CALLS}.documents`,
            async (response) => {
                const call = response.payload as unknown as ActiveCall;
                const event = response.events[0];

                // Incoming call (user is receiver and call is ringing)
                if (call.receiverId === user.$id && call.status === 'ringing' && event.includes('.create')) {
                    // Fetch caller info
                    try {
                        const callerDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.USERS, call.callerId);
                        setIncomingCall({
                            ...call,
                            caller: callerDoc as unknown as User
                        });
                    } catch {
                        setIncomingCall(call);
                    }
                }

                // Call was answered (update for caller)
                if (call.callerId === user.$id && call.status === 'answered') {
                    if (callTimeoutRef.current) {
                        clearTimeout(callTimeoutRef.current);
                        callTimeoutRef.current = null;
                    }
                    setCurrentCall(call);
                }

                // Call ended or declined
                if ((call.status === 'ended' || call.status === 'declined') &&
                    (call.callerId === user.$id || call.receiverId === user.$id)) {
                    if (call.$id === currentCall?.$id) {
                        setCurrentCall(null);
                        webRTC.leaveChannel();
                    }
                    if (call.$id === incomingCall?.$id) {
                        setIncomingCall(null);
                    }
                }
            }
        );

        return () => {
            unsubscribe();
        };
    }, [user?.$id, currentCall?.$id, incomingCall?.$id, webRTC]);

    // Handle remote streams from WebRTC
    useEffect(() => {
        if (webRTC.participants.size > 0) {
            const firstParticipant = Array.from(webRTC.participants.values())[0];
            if (firstParticipant?.stream) {
                setRemoteStream(firstParticipant.stream);
            }
        }
    }, [webRTC.participants]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
            }
        };
    }, []);

    return {
        currentCall,
        incomingCall,
        isInCall: !!currentCall && currentCall.status === 'answered',
        isCalling: !!currentCall && currentCall.status === 'ringing',
        isMuted: webRTC.isMuted,
        isVideoOn: webRTC.isVideoOn,
        isScreenSharing: webRTC.isScreenSharing,
        localStream: webRTC.localStream,
        remoteStream,
        startCall,
        answerCall,
        declineCall,
        endCall,
        toggleMute: webRTC.toggleMute,
        toggleVideo: webRTC.toggleVideo,
        toggleScreenShare,
    };
}
