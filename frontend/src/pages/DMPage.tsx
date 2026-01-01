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
    SendHorizontal
} from 'lucide-react';
import { useMessageStore, subscribeToMessages } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useDMs } from '@/hooks/useDMs';
import { useCallContext } from '@/providers/CallProvider';
import { formatMessageTime } from '@/lib/utils';
import type { Message as MessageType, User } from '@/types';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';

/**
 * DM Page - Direct message conversation view with calling support
 */
export function DMPage() {
    const { channelId } = useParams<{ channelId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { dmChannels } = useDMs();
    const { startCall: startGlobalCall } = useCallContext();
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

    // Start call using global CallProvider
    const handleStartCall = (type: 'voice' | 'video') => {
        if (!channelId || !friend) return;
        startGlobalCall(friend.$id, channelId, type, friend);
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
                        onClick={() => handleStartCall('voice')}
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="Start Voice Call"
                    >
                        <Phone size={20} />
                    </button>
                    <button
                        onClick={() => handleStartCall('video')}
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
                                onClick={() => handleStartCall('voice')}
                                className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-modifier-hover rounded-md text-text-normal transition-colors"
                            >
                                <Phone size={16} />
                                Voice Call
                            </button>
                            <button
                                onClick={() => handleStartCall('video')}
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

