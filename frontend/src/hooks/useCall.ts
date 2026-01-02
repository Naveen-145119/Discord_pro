import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { ID } from 'appwrite';
import { useAuthStore } from '@/stores/authStore';
import { useWebRTC } from './useWebRTC';
import { useRealtime } from '@/providers/RealtimeProvider';
import type { User, CallLogMetadata } from '@/types';

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
    remoteStreamVersion: number;
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

    const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callStartTimeRef = useRef<number | null>(null);
    const callLogCreatedRef = useRef<boolean>(false);

    // Helper function to create call log message
    const createCallLogMessage = useCallback(async (
        channelId: string,
        callerId: string,
        receiverId: string,
        callType: 'voice' | 'video',
        callStatus: 'ended' | 'missed' | 'declined',
        duration?: number
    ) => {
        if (!user?.$id) return;
        
        try {
            const metadata: CallLogMetadata = {
                callType,
                callStatus,
                duration,
                callerId,
                receiverId,
            };

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.MESSAGES,
                ID.unique(),
                {
                    channelId,
                    authorId: callerId,
                    content: '', // Content will be generated on display
                    type: 'call',
                    replyToId: null,
                    attachments: [],
                    metadata: JSON.stringify(metadata),
                    mentionUserIds: [],
                    mentionEveryone: false,
                    isPinned: false,
                    isEdited: false,
                    editedAt: null,
                }
            );
            console.log('[useCall] Call log message created:', callStatus, duration ? `${duration}s` : '');
        } catch (err) {
            console.error('[useCall] Failed to create call log message:', err);
        }
    }, [user?.$id]);

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

    const startCall = useCallback(async (friendId: string, channelId: string, callType: CallType) => {
        if (!user?.$id) throw new Error('Not authenticated');

        // Reset call tracking
        callLogCreatedRef.current = false;
        callStartTimeRef.current = null;

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

            // Set timeout for missed call (30 seconds)
            callTimeoutRef.current = setTimeout(async () => {
                if (call.$id) {
                    try {
                        await databases.updateDocument(
                            DATABASE_ID,
                            COLLECTIONS.ACTIVE_CALLS,
                            call.$id,
                            { status: 'ended' }
                        );
                        // Create missed call log
                        if (!callLogCreatedRef.current) {
                            callLogCreatedRef.current = true;
                            await createCallLogMessage(
                                channelId,
                                user.$id,
                                friendId,
                                callType,
                                'missed'
                            );
                        }
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
    }, [user?.$id, webRTC, createCallLogMessage]);

    const answerCall = useCallback(async () => {
        if (!incomingCall) return;

        // Store these values before clearing incomingCall
        const callToAnswer = incomingCall;
        const answerTargetUserId = incomingCall.callerId;
        const answerChannelId = incomingCall.channelId;

        // Reset call tracking and start timer
        callLogCreatedRef.current = false;
        callStartTimeRef.current = Date.now();

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

        const callToDecline = incomingCall;

        try {
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.ACTIVE_CALLS,
                callToDecline.$id,
                { status: 'declined' }
            );

            // Create declined call log
            await createCallLogMessage(
                callToDecline.channelId,
                callToDecline.callerId,
                callToDecline.receiverId,
                callToDecline.callType,
                'declined'
            );

            setIncomingCall(null);
        } catch (err) {
            console.error('Failed to decline call:', err);
        }
    }, [incomingCall, createCallLogMessage]);

    const endCall = useCallback(async () => {
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }

        const callToEnd = currentCall;
        
        if (callToEnd) {
            // Calculate call duration
            const duration = callStartTimeRef.current 
                ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
                : 0;

            try {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACTIVE_CALLS,
                    callToEnd.$id,
                    { status: 'ended' }
                );

                // Create call ended log (only if call was answered and we haven't created one yet)
                if (!callLogCreatedRef.current && callToEnd.status === 'answered') {
                    callLogCreatedRef.current = true;
                    await createCallLogMessage(
                        callToEnd.channelId,
                        callToEnd.callerId,
                        callToEnd.receiverId,
                        callToEnd.callType,
                        'ended',
                        duration
                    );
                }
            } catch {
            }
        }

        // Reset call tracking
        callStartTimeRef.current = null;

        webRTC.leaveChannel();
        setCurrentCall(null);
        setRemoteStream(null);
    }, [currentCall, webRTC, createCallLogMessage]);

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
                // Start tracking call duration when answered (for caller side)
                if (!callStartTimeRef.current) {
                    callStartTimeRef.current = Date.now();
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
    
    // Track changes in audio tracks for proper stream updates
    const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);

    useEffect(() => {
        const participantsArray = Array.from(webRTC.participants.values());

        if (participantsArray.length > 0) {
            const participantWithStream = participantsArray.find(p => p.stream);
            if (participantWithStream?.stream) {
                const stream = participantWithStream.stream;
                const trackIds = stream.getTracks().map(t => t.id).join(',');
                
                // Check if this is a new stream OR if tracks have changed
                if (remoteStream !== stream) {
                    console.log('[useCall] Setting remote stream from participant:', participantWithStream.odId);
                    setRemoteStream(stream);
                    setRemoteStreamVersion(v => v + 1);
                } else if (remoteStream && trackIds !== remoteStream.getTracks().map(t => t.id).join(',')) {
                    // Same stream object but tracks changed - force re-render
                    console.log('[useCall] Remote stream tracks changed, forcing update');
                    setRemoteStreamVersion(v => v + 1);
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
        remoteStreamVersion,
        startCall,
        answerCall,
        declineCall,
        endCall,
        toggleMute: webRTC.toggleMute,
        toggleVideo: webRTC.toggleVideo,
        toggleScreenShare,
    };
}
