import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCall, type CallType, type ActiveCall } from '@/hooks/useCall';
import { IncomingCallModal } from '@/components/modals/IncomingCallModal';
import { ActiveCallModal } from '@/components/modals/ActiveCallModal';
import { CallAudioManager } from '@/components/call';
import { MiniPlayer } from '@/components/call/MiniPlayer';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

interface CallContextType {
    startCall: (friendId: string, channelId: string, callType: CallType, friend: User) => Promise<void>;
    isInCall: boolean;
    isCalling: boolean;
    currentCall: ActiveCall | null;
    isMinimized: boolean;
    setIsMinimized: (minimized: boolean) => void;
    // Controls
    toggleMute: () => void;
    toggleDeafen: () => void;
    toggleVideo: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    endCall: () => void;
    // State
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    connectionState: string;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCallContext() {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCallContext must be used within CallProvider');
    }
    return context;
}

interface CallProviderProps {
    children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
    const call = useCall();
    const { user: authUser } = useAuthStore();
    const [callFriend, setCallFriend] = useState<User | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isStartingCall, setIsStartingCall] = useState(false); // Track if we're initiating a call
    const callStartTimeRef = useState<number | null>(null);

    // Debug logging
    console.log('[CallProvider] Render - currentCall:', call.currentCall?.$id, 'isCalling:', call.isCalling, 'isStartingCall:', isStartingCall, 'callFriend:', callFriend?.displayName);

    const startCallWithFriend = async (friendId: string, channelId: string, callType: CallType, friend: User) => {
        console.log('[CallProvider] startCallWithFriend called:', { friendId, channelId, callType, friend: friend.displayName });

        // Set these IMMEDIATELY so UI shows right away
        setCallFriend(friend);
        setIsMinimized(false);
        setIsStartingCall(true); // Show calling UI immediately!

        try {
            await call.startCall(friendId, channelId, callType, {
                displayName: friend.displayName,
                avatarUrl: friend.avatarUrl || undefined,
            });
            console.log('[CallProvider] startCall completed');
        } catch (err) {
            console.error('[CallProvider] startCall failed:', err);
            // Reset on error
            setIsStartingCall(false);
            setCallFriend(null);
        }
    };

    // Clear isStartingCall when we have a real currentCall
    useEffect(() => {
        if (call.currentCall) {
            setIsStartingCall(false);
        }
    }, [call.currentCall]);

    useEffect(() => {
        if (!call.currentCall && !isStartingCall) {
            setCallFriend(null);
            setIsMinimized(false);
            setCallDuration(0);
            callStartTimeRef[1](null);
        }
    }, [call.currentCall, isStartingCall, callStartTimeRef]);

    // Call duration timer
    useEffect(() => {
        if (call.remoteStream && !call.isCalling) {
            if (!callStartTimeRef[0]) {
                callStartTimeRef[1](Date.now());
            }

            const interval = setInterval(() => {
                if (callStartTimeRef[0]) {
                    setCallDuration(Math.floor((Date.now() - callStartTimeRef[0]) / 1000));
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [call.remoteStream, call.isCalling, callStartTimeRef]);

    const getCurrentFriend = (): User | null => {
        if (callFriend) return callFriend;

        if (call.currentCall?.caller) return call.currentCall.caller;
        if (call.currentCall?.receiver) return call.currentCall.receiver;

        if (call.incomingCall?.caller) return call.incomingCall.caller;

        return null;
    };

    const currentFriend = getCurrentFriend();

    return (
        <CallContext.Provider value={{
            startCall: startCallWithFriend,
            isInCall: call.isInCall,
            isCalling: call.isCalling,
            currentCall: call.currentCall,
            isMinimized,
            setIsMinimized,
            // Controls
            toggleMute: call.toggleMute,
            toggleDeafen: call.toggleDeafen,
            toggleVideo: call.toggleVideo,
            toggleScreenShare: call.toggleScreenShare,
            endCall: call.endCall,
            // State
            isMuted: call.isMuted,
            isDeafened: call.isDeafened,
            isVideoOn: call.isVideoOn,
            isScreenSharing: call.isScreenSharing,
            connectionState: call.connectionState,
        }}>
            {children}

            {/* Incoming Call Modal */}
            {call.incomingCall && (
                <IncomingCallModal
                    call={call.incomingCall}
                    onAnswer={call.answerCall}
                    onDecline={call.declineCall}
                />
            )}

            {/* Persistent Audio Manager handles playback regardless of UI state */}
            {call.remoteStream && (
                <CallAudioManager
                    remoteStream={call.remoteStream}
                    remoteStreamVersion={call.remoteStreamVersion}
                />
            )}

            {/* Active Call - Full Modal or Mini Player */}
            <AnimatePresence mode="wait">
                {/* Show when we have currentCall OR when we're starting a call */}
                {((call.currentCall && currentFriend) || (isStartingCall && callFriend)) && (
                    isMinimized ? (
                        <MiniPlayer
                            friend={currentFriend || callFriend!}
                            remoteStream={call.remoteStream}
                            localStream={call.localStream}
                            isMuted={call.isMuted}
                            isVideoOn={call.isVideoOn}
                            callDuration={callDuration}
                            onExpand={() => setIsMinimized(false)}
                            onEndCall={call.endCall}
                            onToggleMute={call.toggleMute}
                            onToggleVideo={call.toggleVideo}
                        />
                    ) : (
                        <ActiveCallModal
                            key="active-call"
                            call={call.currentCall || {
                                $id: 'starting',
                                callerId: '',
                                receiverId: '',
                                channelId: '',
                                callType: 'voice',
                                status: 'ringing',
                            }}
                            friend={currentFriend || callFriend!}
                            currentUserId={authUser?.$id || ''}
                            localDisplayName={authUser?.displayName || 'You'}
                            localAvatarUrl={authUser?.avatarUrl || undefined}
                            isMuted={call.isMuted}
                            isDeafened={call.isDeafened}
                            isVideoOn={call.isVideoOn}
                            isScreenSharing={call.isScreenSharing}
                            isSpeaking={call.isSpeaking}
                            localStream={call.localStream}
                            screenStream={call.screenStream}
                            remoteStream={call.remoteStream}
                            remoteStreamVersion={call.remoteStreamVersion}
                            participants={call.participants}
                            remoteParticipant={call.remoteParticipant}
                            isCalling={isStartingCall || call.isCalling}
                            callDuration={callDuration}
                            onEndCall={call.endCall}
                            onToggleMute={call.toggleMute}
                            onToggleDeafen={call.toggleDeafen}
                            onToggleVideo={call.toggleVideo}
                            onToggleScreenShare={call.toggleScreenShare}
                            onMinimize={() => setIsMinimized(true)}
                        />
                    )
                )}
            </AnimatePresence>
        </CallContext.Provider>
    );
}

