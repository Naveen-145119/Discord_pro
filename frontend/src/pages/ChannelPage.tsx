import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Hash,
    Bell,
    Pin,
    Users,
    Search,
    Inbox,
    HelpCircle,
    PlusCircle,
    Gift,
    Sticker,
    Smile,
    SendHorizontal
} from 'lucide-react';
import { useMessageStore, subscribeToMessages } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { formatMessageTime } from '@/lib/utils';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import type { Message as MessageType } from '@/types';

export function ChannelPage() {
    const { channelId } = useParams<{ channelId: string }>();
    const { user } = useAuthStore();
    const { channels } = useServerStore();
    const {
        messages,
        hasMore,
        isLoading,
        isSending,
        fetchMessages,
        sendMessage,
        setCurrentChannel,
        clearMessages
    } = useMessageStore();

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const currentChannel = channels.find((c: { $id: string }) => c.$id === channelId);
    const serverId = currentChannel?.serverId || undefined;
    const { can } = usePermission(serverId ?? undefined, channelId);
    const canSendMessages = can(PERMISSIONS.SEND_MESSAGES);

    useEffect(() => {
        if (channelId && currentChannel) {
            setCurrentChannel(currentChannel);
            fetchMessages(channelId);
        }

        return () => {
            clearMessages();
        };
    }, [channelId, currentChannel, setCurrentChannel, fetchMessages, clearMessages]);

    useEffect(() => {
        if (!channelId) return;

        const unsubscribe = subscribeToMessages(channelId);
        return () => {
            unsubscribe();
        };
    }, [channelId]);

    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]);

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container || isLoading || !hasMore) return;

        if (container.scrollTop === 0 && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            fetchMessages(channelId!, lastMessage.$id);
        }
    };

    if (!currentChannel) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-text-muted">Channel not found</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background-primary">
            <div className="h-12 px-4 flex items-center justify-between border-b border-background-tertiary shadow-elevation-low">
                <div className="flex items-center gap-2">
                    <Hash size={24} className="text-channel-icon" />
                    <span className="font-semibold text-text-heading">
                        {currentChannel.name}
                    </span>
                    {currentChannel.topic && (
                        <>
                            <div className="w-px h-6 bg-background-modifier-active" />
                            <span className="text-sm text-text-muted truncate max-w-xs">
                                {currentChannel.topic}
                            </span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button className="text-interactive-normal hover:text-interactive-hover" title="Notification Settings">
                        <Bell size={20} />
                    </button>
                    <button className="text-interactive-normal hover:text-interactive-hover" title="Pinned Messages">
                        <Pin size={20} />
                    </button>
                    <button className="text-interactive-normal hover:text-interactive-hover" title="Member List">
                        <Users size={20} />
                    </button>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search"
                            className="w-36 h-6 px-2 bg-background-tertiary rounded text-sm text-text-normal placeholder:text-text-muted focus:outline-none focus:w-56 transition-all"
                        />
                        <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
                    </div>
                    <button className="text-interactive-normal hover:text-interactive-hover" title="Inbox">
                        <Inbox size={20} />
                    </button>
                    <button className="text-interactive-normal hover:text-interactive-hover" title="Help">
                        <HelpCircle size={20} />
                    </button>
                </div>
            </div>

            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto flex flex-col-reverse"
            >
                <div ref={messagesEndRef} />

                {messages.length === 0 && !isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mb-4">
                            <Hash size={32} className="text-text-heading" />
                        </div>
                        <h3 className="text-2xl font-bold text-text-heading mb-2">
                            Welcome to #{currentChannel.name}!
                        </h3>
                        <p className="text-text-muted text-center max-w-md">
                            This is the start of the #{currentChannel.name} channel.
                        </p>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        {isLoading && (
                            <div className="flex justify-center py-4">
                                <div className="w-6 h-6 border-2 border-discord-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}

                        {[...messages].reverse().map((message) => (
                            <MessageItem key={message.$id} message={message} />
                        ))}
                    </div>
                )}
            </div>

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
                        placeholder={canSendMessages ? `Message #${currentChannel.name}` : 'You do not have permission to send messages in this channel'}
                        className={`flex-1 bg-transparent py-2.5 text-text-normal placeholder:text-text-muted focus:outline-none ${!canSendMessages ? 'cursor-not-allowed opacity-50' : ''}`}
                        disabled={isSending || !canSendMessages}
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

function MessageItem({ message }: { message: MessageType }) {
    return (
        <div className="message-container group">
            <div className="avatar w-10 h-10 mt-0.5 flex-shrink-0 bg-discord-primary">
                <span className="text-sm font-medium text-white">
                    {message.authorId?.charAt(0) || '?'}
                </span>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="font-medium text-text-heading hover:underline cursor-pointer">
                        User
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
