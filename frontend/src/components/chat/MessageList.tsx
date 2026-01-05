import { useMemo, useRef, useEffect } from 'react';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes } from 'date-fns';
import type { Message, User } from '@/types';
import { MessageItem } from './MessageItem';
import { SoundManager } from '@/lib/soundManager';

// Time threshold for grouping messages (in minutes)
const GROUPING_TIME_THRESHOLD = 5;

export interface ProcessedMessage {
    message: Message;
    isHeader: boolean;
    showDateSeparator: boolean;
    dateLabel: string;
}

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
    currentUser?: { displayName: string; avatarUrl?: string | null };
    friend?: User | null;
    onReply?: (message: Message) => void;
    onEdit?: (message: Message) => void;
    onEditSave?: (messageId: string, content: string) => Promise<void>;
    onDelete?: (message: Message) => void;
    onReaction?: (message: Message, emoji: string) => void;
    onStartCall?: (type: 'voice' | 'video') => void;
    isLoading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
}

/**
 * Formats a date for the date separator
 */
function formatDateSeparator(date: Date): string {
    if (isToday(date)) {
        return 'Today';
    }
    if (isYesterday(date)) {
        return 'Yesterday';
    }
    return format(date, 'MMMM d, yyyy');
}

/**
 * Processes messages to determine grouping and date separators
 */
function processMessages(messages: Message[]): ProcessedMessage[] {
    if (messages.length === 0) return [];

    // Messages come in newest-first order, we need to reverse for processing
    const chronological = [...messages].reverse();
    const result: ProcessedMessage[] = [];

    for (let i = 0; i < chronological.length; i++) {
        const current = chronological[i];
        const previous = i > 0 ? chronological[i - 1] : null;

        const currentDate = new Date(current.$createdAt);
        const previousDate = previous ? new Date(previous.$createdAt) : null;

        // Check if we need a date separator
        const showDateSeparator = !previous || !isSameDay(currentDate, previousDate!);
        const dateLabel = showDateSeparator ? formatDateSeparator(currentDate) : '';

        // Check if this is a "header" message (new author or time gap > 5 min)
        let isHeader = true;
        if (previous && !showDateSeparator) {
            const sameAuthor = current.authorId === previous.authorId;
            const timeDiff = differenceInMinutes(currentDate, previousDate!);
            const withinTimeThreshold = timeDiff < GROUPING_TIME_THRESHOLD;

            // It's grouped (not a header) if same author AND within time threshold
            isHeader = !(sameAuthor && withinTimeThreshold);
        }

        result.push({
            message: current,
            isHeader,
            showDateSeparator,
            dateLabel,
        });
    }

    return result;
}

export function MessageList({
    messages,
    currentUserId,
    currentUser,
    friend,
    onReply,
    onEdit,
    onEditSave,
    onDelete,
    onReaction,
    onStartCall,
    isLoading,
    hasMore,
    onLoadMore,
}: MessageListProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const prevMessageCountRef = useRef(messages.length);

    // Process messages for grouping
    const processedMessages = useMemo(() => processMessages(messages), [messages]);

    // Auto-scroll to bottom on new messages + play sound
    useEffect(() => {
        if (endRef.current && messages.length > 0) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }

        // Play sound when a new message arrives from another user
        if (messages.length > prevMessageCountRef.current) {
            const newestMessage = messages[0]; // Messages are newest-first
            if (newestMessage && newestMessage.authorId !== currentUserId) {
                SoundManager.playMessage();
            }
        }
        prevMessageCountRef.current = messages.length;
    }, [messages.length, messages, currentUserId]);

    // Handle scroll for infinite loading
    const handleScroll = () => {
        const container = containerRef.current;
        if (!container || isLoading || !hasMore) return;

        if (container.scrollTop === 0) {
            onLoadMore?.();
        }
    };

    if (messages.length === 0 && !isLoading) {
        return null; // Let parent handle empty state
    }

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto flex flex-col-reverse"
        >
            <div ref={endRef} />

            <div className="py-4">
                {isLoading && (
                    <div className="flex justify-center py-4">
                        <div className="w-6 h-6 border-2 border-discord-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {processedMessages.map((processed) => (
                    <div key={processed.message.$id}>
                        {/* Date Separator */}
                        {processed.showDateSeparator && (
                            <DateSeparator label={processed.dateLabel} />
                        )}

                        {/* Message Item */}
                        <MessageItem
                            message={processed.message}
                            isHeader={processed.isHeader}
                            isOwnMessage={processed.message.authorId === currentUserId}
                            currentUser={currentUser}
                            friend={friend}
                            onReply={onReply}
                            onEdit={onEdit}
                            onEditSave={onEditSave}
                            onDelete={onDelete}
                            onReaction={onReaction}
                            onStartCall={onStartCall}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Date separator component
 */
function DateSeparator({ label }: { label: string }) {
    return (
        <div className="relative flex items-center justify-center my-4 mx-4">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-background-modifier-accent" />
            </div>
            <span className="relative px-4 text-xs font-semibold text-text-muted bg-background-primary">
                {label}
            </span>
        </div>
    );
}
