import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';

import { useAuthStore } from '@/stores/authStore';
import { useWebRTC } from './useWebRTC';
import { useRealtime } from '@/providers/RealtimeProvider';
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
    currentCall: ActiveCall | null;
    incomingCall: ActiveCall | null;
    isInCall: boolean;
    isCalling: boolean;
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    startCall: (friendId: string, channelId: string, callType: CallType) => Promise<void>;
    answerCall: () => Promise<void>;
    declineCall: () => Promise<void>;
    endCall: () => Promise<void>;
    toggleMute: () => void;
    toggleVideo: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
}

export function useCall(): UseCallReturn {
    const { user } = useAuthStore();
    const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
    const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const targetUserId = useMemo(() => {
        const call = currentCall || incomingCall;
        if (!call) return '';
        return call.callerId === user?.$id ? call.receiverId : call.callerId;
    }, [currentCall, incomingCall, user?.$id]);

    const isInitiator = useMemo(() => {
        const call = currentCall || incomingCall;
        if (!call) return true;
        return call.callerId === user?.$id;
    }, [currentCall, incomingCall, user?.$id]);

    const webRTC = useWebRTC({
        channelId: currentCall?.channelId || incomingCall?.channelId || '',
        userId: user?.$id || '',
        displayName: user?.displayName || 'User',
        mode: 'dm',
        targetUserId,
        isInitiator,
    });

    const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startCall = useCallback(async (friendId: string, channelId: string, callType: CallType) => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            const execution = await functions.createExecution(
                'create-call',
                JSON.stringify({
                    receiverId: friendId,
                    channelId,
                    callType
                })
            );

            if (execution.status === 'failed') {
                throw new Error('Function execution failed: ' + (execution.responseBody || execution.errors || 'Unknown error'));
            }

            if (!execution.responseBody) {
                throw new Error('Empty response from server. Please log in again.');
            }

            let response;
            try {
                response = JSON.parse(execution.responseBody);
            } catch {
                throw new Error('Invalid server response');
            }

            if (!response.success) {
                throw new Error(response.error || 'Failed to create call');
            }

            const call = response.data;

            setCurrentCall(call as unknown as ActiveCall);

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
                    }
                }
            }, 30000);

            const callTargetUserId = friendId;
            await webRTC.joinChannel({ channelId, targetUserId: callTargetUserId, isInitiator: true });
        } catch (err) {
            console.error('Failed to start call:', err);
            throw err;
        }
    }, [user?.$id, webRTC]);

    const answerCall = useCallback(async () => {
        if (!incomingCall) return;

        // Store these values before clearing incomingCall
        const callToAnswer = incomingCall;
        const answerTargetUserId = incomingCall.callerId;
        const answerChannelId = incomingCall.channelId;

        try {
            // Update call status first
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.ACTIVE_CALLS,
                callToAnswer.$id,
                { status: 'answered' }
            );

            // Set current call BEFORE clearing incoming call to avoid race condition
            setCurrentCall({
                ...callToAnswer,
                status: 'answered'
            });
            
            // Clear incoming call after setting current call
            setIncomingCall(null);

            // Join WebRTC with stored values (not dependent on state)
            await webRTC.joinChannel({ 
                channelId: answerChannelId, 
                targetUserId: answerTargetUserId, 
                isInitiator: false 
            });
        } catch (err) {
            console.error('Failed to answer call:', err);
            throw err;
        }
    }, [incomingCall, webRTC]);

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
            }
        }

        webRTC.leaveChannel();
        setCurrentCall(null);
        setRemoteStream(null);
    }, [currentCall, webRTC]);

    const toggleScreenShare = useCallback(async () => {
        if (webRTC.isScreenSharing) {
            webRTC.stopScreenShare();
        } else {
            await webRTC.startScreenShare();
        }
    }, [webRTC]);

    const { subscribe } = useRealtime();

    useEffect(() => {
        if (!user?.$id) return;

        const unsubscribe = subscribe(async (event) => {
            if (event.collection !== COLLECTIONS.ACTIVE_CALLS) return;

            const call = event.payload as ActiveCall;

            if (call.receiverId === user.$id && call.status === 'ringing' && event.event.includes('.create')) {
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

            if (call.callerId === user.$id && call.status === 'answered') {
                if (callTimeoutRef.current) {
                    clearTimeout(callTimeoutRef.current);
                    callTimeoutRef.current = null;
                }
                setCurrentCall(prev => {
                    if (!prev) {
                        return { ...call, status: 'answered' };
                    }
                    return { ...prev, ...call, status: 'answered' };
                });
            }

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
        });

        return unsubscribe;
    }, [user?.$id, currentCall?.$id, incomingCall?.$id, webRTC, subscribe]);

    const participantsSize = webRTC.participants.size;
    const participantIds = Array.from(webRTC.participants.keys()).join(',');

    useEffect(() => {
        const participantsArray = Array.from(webRTC.participants.values());

        if (participantsArray.length > 0) {
            const participantWithStream = participantsArray.find(p => p.stream);
            if (participantWithStream?.stream) {
                if (remoteStream !== participantWithStream.stream) {
                    console.log('[useCall] Setting remote stream from participant:', participantWithStream.odId);
                    setRemoteStream(participantWithStream.stream);
                }
            }
        }
    }, [participantsSize, participantIds, webRTC.participants, remoteStream]);

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
