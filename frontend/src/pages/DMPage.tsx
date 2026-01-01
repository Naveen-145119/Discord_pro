import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Phone,
    Video,
    MoreVertical,
    PlusCircle,
    Gift,
    Sticker,
    Smile,
    SendHorizontal,
    MonitorUp
} from 'lucide-react';
import { useMessageStore, subscribeToMessages } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useDMs } from '@/hooks/useDMs';
import { formatMessageTime } from '@/lib/utils';
import type { Message as MessageType, User } from '@/types';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
// Query import removed - not currently used

/**
 * DM Page - Direct message conversation view with calling support
 */
export function DMPage() {
    const { channelId } = useParams<{ channelId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { dmChannels } = useDMs();
    const {
        messages,
        hasMore,
        isLoading,
        isSending,
        fetchMessages,
        sendMessage,
        clearMessages
    } = useMessageStore();

    const [inputValue, setInputValue] = useState('');
    const [friend, setFriend] = useState<User | null>(null);
    const [isCallModalOpen, setIsCallModalOpen] = useState(false);
    const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Find current DM channel and friend
    useEffect(() => {
        const dmChannel = dmChannels.find(dm => dm.$id === channelId);
        if (dmChannel) {
            setFriend(dmChannel.friend);
        } else if (channelId) {
            // If not in dmChannels yet, fetch directly
            const fetchDMDetails = async () => {
                try {
                    const dm = await databases.getDocument(DATABASE_ID, COLLECTIONS.DM_CHANNELS, channelId);
                    const friendId = (dm.participantIds as string[]).find(id => id !== user?.$id);
                    if (friendId) {
                        const friendDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.USERS, friendId);
                        setFriend(friendDoc as unknown as User);
                    }
                } catch (err) {
                    console.error('Error fetching DM details:', err);
                }
            };
            fetchDMDetails();
        }
    }, [channelId, dmChannels, user?.$id]);

    // Fetch messages
    useEffect(() => {
        if (channelId) {
            fetchMessages(channelId);
        }

        return () => {
            clearMessages();
        };
    }, [channelId, fetchMessages, clearMessages]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!channelId) return;

        const unsubscribe = subscribeToMessages(channelId);
        return () => {
            unsubscribe();
        };
    }, [channelId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]);

    // Handle send message
    const handleSend = async () => {
        if (!inputValue.trim() || !channelId || !user?.$id) return;

        const content = inputValue;
        setInputValue('');

        try {
            await sendMessage(channelId, user.$id, content);
        } catch {
            setInputValue(content);
        }
    };

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Load more messages on scroll to top
    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container || isLoading || !hasMore) return;

        if (container.scrollTop === 0 && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            fetchMessages(channelId!, lastMessage.$id);
        }
    };

    // Start call
    const startCall = (type: 'voice' | 'video') => {
        setCallType(type);
        setIsCallModalOpen(true);
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-status-online';
            case 'idle': return 'bg-status-idle';
            case 'dnd': return 'bg-status-dnd';
            default: return 'bg-status-offline';
        }
    };

    if (!friend) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-discord-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background-primary">
            {/* Header */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-background-tertiary shadow-elevation-low">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="text-interactive-normal hover:text-interactive-hover md:hidden"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    {/* Friend avatar and info */}
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-discord-primary flex items-center justify-center">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-sm font-medium text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background-primary ${getStatusColor(friend.status)}`} />
                    </div>

                    <div>
                        <span className="font-semibold text-text-heading">
                            {friend.displayName}
                        </span>
                    </div>
                </div>

                {/* Call buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => startCall('voice')}
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="Start Voice Call"
                    >
                        <Phone size={20} />
                    </button>
                    <button
                        onClick={() => startCall('video')}
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="Start Video Call"
                    >
                        <Video size={20} />
                    </button>
                    <button
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="More Options"
                    >
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto flex flex-col-reverse"
            >
                <div ref={messagesEndRef} />

                {messages.length === 0 && !isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="w-20 h-20 rounded-full bg-discord-primary flex items-center justify-center mb-4">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-2xl font-medium text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-bold text-text-heading mb-2">
                            {friend.displayName}
                        </h3>
                        <p className="text-text-muted text-center max-w-md mb-4">
                            This is the beginning of your direct message history with <strong>{friend.displayName}</strong>.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => startCall('voice')}
                                className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-modifier-hover rounded-md text-text-normal transition-colors"
                            >
                                <Phone size={16} />
                                Voice Call
                            </button>
                            <button
                                onClick={() => startCall('video')}
                                className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-modifier-hover rounded-md text-text-normal transition-colors"
                            >
                                <Video size={16} />
                                Video Call
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        {isLoading && (
                            <div className="flex justify-center py-4">
                                <div className="w-6 h-6 border-2 border-discord-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}

                        {[...messages].reverse().map((message) => (
                            <DMMessageItem
                                key={message.$id}
                                message={message}
                                friend={friend}
                                currentUserId={user?.$id || ''}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="px-4 pb-6">
                <div className="flex items-center gap-2 bg-background-tertiary rounded-lg px-4">
                    <button className="text-interactive-normal hover:text-interactive-hover py-2.5">
                        <PlusCircle size={20} />
                    </button>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message @${friend.displayName}`}
                        className="flex-1 bg-transparent py-2.5 text-text-normal placeholder:text-text-muted focus:outline-none"
                        disabled={isSending}
                    />

                    <div className="flex items-center gap-1">
                        <button className="text-interactive-normal hover:text-interactive-hover p-1.5">
                            <Gift size={20} />
                        </button>
                        <button className="text-interactive-normal hover:text-interactive-hover p-1.5">
                            <Sticker size={20} />
                        </button>
                        <button className="text-interactive-normal hover:text-interactive-hover p-1.5">
                            <Smile size={20} />
                        </button>
                        {inputValue.trim() && (
                            <button
                                onClick={handleSend}
                                disabled={isSending}
                                className="text-discord-primary hover:text-discord-primary/80 p-1.5"
                            >
                                <SendHorizontal size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Call Modal */}
            {isCallModalOpen && callType && (
                <DMCallModal
                    channelId={channelId!}
                    friend={friend}
                    callType={callType}
                    onClose={() => {
                        setIsCallModalOpen(false);
                        setCallType(null);
                    }}
                />
            )}
        </div>
    );
}

// DM Message item component
function DMMessageItem({
    message,
    friend,
    currentUserId
}: {
    message: MessageType;
    friend: User;
    currentUserId: string;
}) {
    const isOwnMessage = message.authorId === currentUserId;
    const displayUser = isOwnMessage ? null : friend;

    return (
        <div className="message-container group">
            {/* Avatar */}
            <div className="avatar w-10 h-10 mt-0.5 flex-shrink-0 bg-discord-primary">
                {displayUser?.avatarUrl ? (
                    <img src={displayUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                    <span className="text-sm font-medium text-white">
                        {isOwnMessage ? 'Y' : friend.displayName?.charAt(0) || '?'}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="font-medium text-text-heading hover:underline cursor-pointer">
                        {isOwnMessage ? 'You' : friend.displayName}
                    </span>
                    <span className="text-xs text-text-muted">
                        {formatMessageTime(message.$createdAt)}
                    </span>
                    {message.isEdited && (
                        <span className="text-xs text-text-muted">(edited)</span>
                    )}
                </div>
                <p className="text-text-normal whitespace-pre-wrap break-words">
                    {message.content}
                </p>
            </div>
        </div>
    );
}

// DM Call Modal component
function DMCallModal({
    channelId: _channelId,
    friend,
    callType,
    onClose
}: {
    channelId: string;
    friend: User;
    callType: 'voice' | 'video';
    onClose: () => void;
}) {
    const { user: _user } = useAuthStore();
    const [isConnecting, setIsConnecting] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Simulated connection for now - will integrate with useWebRTC
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsConnecting(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-status-online';
            case 'idle': return 'bg-status-idle';
            case 'dnd': return 'bg-status-dnd';
            default: return 'bg-status-offline';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-background-secondary rounded-lg w-full max-w-4xl mx-4 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-background-tertiary flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-discord-primary flex items-center justify-center">
                                {friend.avatarUrl ? (
                                    <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span className="text-lg font-medium text-white">
                                        {friend.displayName?.charAt(0) || '?'}
                                    </span>
                                )}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background-secondary ${getStatusColor(friend.status)}`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-text-heading">{friend.displayName}</h3>
                            <p className="text-sm text-text-muted">
                                {isConnecting ? 'Connecting...' : callType === 'video' ? 'Video Call' : 'Voice Call'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Video area */}
                <div className="aspect-video bg-background-primary relative">
                    {isConnecting ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="w-24 h-24 rounded-full bg-discord-primary flex items-center justify-center mb-4">
                                {friend.avatarUrl ? (
                                    <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span className="text-3xl font-medium text-white">
                                        {friend.displayName?.charAt(0) || '?'}
                                    </span>
                                )}
                            </div>
                            <p className="text-text-muted animate-pulse">Calling {friend.displayName}...</p>
                        </div>
                    ) : (
                        <>
                            {/* Remote video */}
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />

                            {/* Local video (picture-in-picture) */}
                            {isVideoOn && (
                                <div className="absolute bottom-4 right-4 w-48 aspect-video bg-background-tertiary rounded-lg overflow-hidden shadow-lg">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Controls */}
                <div className="p-4 flex items-center justify-center gap-4">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-4 rounded-full transition-colors ${isMuted
                            ? 'bg-red-500 text-white'
                            : 'bg-background-tertiary text-text-normal hover:bg-background-modifier-hover'
                            }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? (
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                <path d="M3.41 2L2 3.41l18 18L21.41 20z" fill="currentColor" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={() => setIsVideoOn(!isVideoOn)}
                        className={`p-4 rounded-full transition-colors ${!isVideoOn
                            ? 'bg-red-500 text-white'
                            : 'bg-background-tertiary text-text-normal hover:bg-background-modifier-hover'
                            }`}
                        title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                        <Video size={24} />
                    </button>

                    <button
                        onClick={() => setIsScreenSharing(!isScreenSharing)}
                        className={`p-4 rounded-full transition-colors ${isScreenSharing
                            ? 'bg-green-500 text-white'
                            : 'bg-background-tertiary text-text-normal hover:bg-background-modifier-hover'
                            }`}
                        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen (1080p 60fps)'}
                    >
                        <MonitorUp size={24} />
                    </button>

                    <button
                        onClick={onClose}
                        className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                        title="End Call"
                    >
                        <Phone size={24} className="rotate-[135deg]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
