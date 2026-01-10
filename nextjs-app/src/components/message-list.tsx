'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useMessages, useSendMessage } from '@/hooks/use-messages';
import { useAuthStore } from '@/stores/auth-store';
import { formatRelativeTime } from '@/lib/utils';
import type { Message } from '@/types';

interface MessageListProps {
    channelId: string;
}

// Message list with infinite scroll (Blueprint Section 4.2)
export function MessageList({ channelId }: MessageListProps) {
    const { user } = useAuthStore();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
    } = useMessages(channelId);

    // Flatten messages from all pages (reverse for chronological order)
    const messages = data?.pages.flatMap(page => page.messages).reverse() ?? [];

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Intersection observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.5 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-[#ED4245]">Failed to load messages</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-4 py-2 thin-scrollbar">
            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-1" />

            {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <p className="text-[#949BA4]">No messages yet. Start the conversation!</p>
                </div>
            ) : (
                messages.map((message, index) => (
                    <MessageItem
                        key={message.$id}
                        message={message}
                        isOwn={message.authorId === user?.$id}
                        showHeader={index === 0 || messages[index - 1]?.authorId !== message.authorId}
                    />
                ))
            )}

            <div ref={messagesEndRef} />
        </div>
    );
}

// Individual message component
function MessageItem({
    message,
    isOwn,
    showHeader
}: {
    message: Message;
    isOwn: boolean;
    showHeader: boolean;
}) {
    return (
        <div className={`message-container ${showHeader ? 'mt-4' : 'mt-0.5'}`}>
            {/* Avatar */}
            {showHeader ? (
                <div className="w-10 h-10 mt-0.5 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-medium flex-shrink-0 overflow-hidden">
                    {message.author?.avatarUrl ? (
                        <img src={message.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        message.author?.username?.charAt(0).toUpperCase() || 'U'
                    )}
                </div>
            ) : (
                <div className="w-10 flex-shrink-0" />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
                {showHeader && (
                    <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-medium ${isOwn ? 'text-[#5865F2]' : 'text-[#F2F3F5]'}`}>
                            {message.author?.displayName || message.author?.username || 'Unknown'}
                        </span>
                        <span className="text-xs text-[#949BA4]">
                            {formatRelativeTime(new Date(message.$createdAt))}
                        </span>
                        {message.isEdited && (
                            <span className="text-xs text-[#949BA4]">(edited)</span>
                        )}
                    </div>
                )}
                <p className="text-[#DBDEE1] text-[15px] leading-[1.375rem] break-words">
                    {message.content}
                </p>
            </div>
        </div>
    );
}

// Message input component
export function MessageInput({ channelId }: { channelId: string }) {
    const { user } = useAuthStore();
    const { mutate: sendMessage, isPending } = useSendMessage();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        if (!inputRef.current?.value.trim() || !user) return;

        sendMessage({
            channelId,
            authorId: user.$id,
            content: inputRef.current.value,
            author: user,
        });

        inputRef.current.value = '';
    }, [channelId, user, sendMessage]);

    return (
        <form onSubmit={handleSubmit} className="p-4">
            <div className="bg-[#383A40] rounded-lg flex items-center px-4 py-2.5">
                <button type="button" className="text-[#B5BAC1] hover:text-[#DBDEE1] mr-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.00098C6.486 2.00098 2 6.48698 2 12.001C2 17.515 6.486 22.001 12 22.001C17.514 22.001 22 17.515 22 12.001C22 6.48698 17.514 2.00098 12 2.00098ZM17 13.001H13V17.001H11V13.001H7V11.001H11V7.00098H13V11.001H17V13.001Z" />
                    </svg>
                </button>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Message #channel"
                    className="flex-1 bg-transparent text-[#DBDEE1] placeholder-[#6D6F78] outline-none"
                    disabled={isPending}
                />
                <div className="flex items-center gap-4 ml-4 text-[#B5BAC1]">
                    <button type="button" className="hover:text-[#DBDEE1]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM8.5 9C9.328 9 10 9.672 10 10.5C10 11.328 9.328 12 8.5 12C7.672 12 7 11.328 7 10.5C7 9.672 7.672 9 8.5 9ZM15.5 9C16.328 9 17 9.672 17 10.5C17 11.328 16.328 12 15.5 12C14.672 12 14 11.328 14 10.5C14 9.672 14.672 9 15.5 9ZM12 18C8.5 18 6 15.5 6 15.5H18C18 15.5 15.5 18 12 18Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </form>
    );
}
