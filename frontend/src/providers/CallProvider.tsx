import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCall, type CallType, type ActiveCall } from '@/hooks/useCall';
import { IncomingCallModal } from '@/components/modals/IncomingCallModal';
import { ActiveCallModal } from '@/components/modals/ActiveCallModal';
import { MiniPlayer } from '@/components/call';
import type { User } from '@/types';

interface CallContextType {
    startCall: (friendId: string, channelId: string, callType: CallType, friend: User) => Promise<void>;
    isInCall: boolean;
    isCalling: boolean;
    currentCall: ActiveCall | null;
    isMinimized: boolean;
    setIsMinimized: (minimized: boolean) => void;
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
    const [callFriend, setCallFriend] = useState<User | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const callStartTimeRef = useState<number | null>(null);

    const startCallWithFriend = async (friendId: string, channelId: string, callType: CallType, friend: User) => {
        setCallFriend(friend);
        setIsMinimized(false); // Always start in full view
        await call.startCall(friendId, channelId, callType);
    };

    useEffect(() => {
        if (!call.currentCall) {
            setCallFriend(null);
            setIsMinimized(false);
            setCallDuration(0);
            callStartTimeRef[1](null);
        }
    }, [call.currentCall, callStartTimeRef]);

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

            {/* Active Call - Full Modal or Mini Player */}
            <AnimatePresence mode="wait">
                {call.currentCall && currentFriend && (
                    isMinimized ? (
                        <MiniPlayer
                            key="mini-player"
                            friend={currentFriend}
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
                            call={call.currentCall}
                            friend={currentFriend}
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
                            isCalling={call.isCalling}
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

