import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useCall, type CallType, type ActiveCall } from '@/hooks/useCall';
import { IncomingCallModal } from '@/components/modals/IncomingCallModal';
import { ActiveCallModal } from '@/components/modals/ActiveCallModal';
import type { User } from '@/types';

interface CallContextType {
    startCall: (friendId: string, channelId: string, callType: CallType, friend: User) => Promise<void>;
    isInCall: boolean;
    isCalling: boolean;
    currentCall: ActiveCall | null;
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

    const startCallWithFriend = async (friendId: string, channelId: string, callType: CallType, friend: User) => {
        setCallFriend(friend);
        await call.startCall(friendId, channelId, callType);
    };

    useEffect(() => {
        if (!call.currentCall) {
            setCallFriend(null);
        }
    }, [call.currentCall]);

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
        }}>
            {children}

            {call.incomingCall && (
                <IncomingCallModal
                    call={call.incomingCall}
                    onAnswer={call.answerCall}
                    onDecline={call.declineCall}
                />
            )}

            {call.currentCall && currentFriend && (
                <ActiveCallModal
                    call={call.currentCall}
                    friend={currentFriend}
                    isMuted={call.isMuted}
                    isVideoOn={call.isVideoOn}
                    isScreenSharing={call.isScreenSharing}
                    localStream={call.localStream}
                    remoteStream={call.remoteStream}
                    isCalling={call.isCalling}
                    onEndCall={call.endCall}
                    onToggleMute={call.toggleMute}
                    onToggleVideo={call.toggleVideo}
                    onToggleScreenShare={call.toggleScreenShare}
                />
            )}
        </CallContext.Provider>
    );
}
