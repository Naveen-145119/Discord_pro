import { X, CornerDownRight } from 'lucide-react';
import type { Message, User } from '@/types';

interface ReplyBarProps {
    message: Message;
    friend?: User | null;
    currentUserId: string;
    currentUser?: { displayName: string };
    onCancel: () => void;
}

/**
 * Reply bar component - shows "Replying to @User" with curved line
 */
export function ReplyBar({ message, friend, currentUserId, currentUser, onCancel }: ReplyBarProps) {
    const isOwnMessage = message.authorId === currentUserId;
    const displayName = isOwnMessage
        ? (currentUser?.displayName || 'yourself')
        : (friend?.displayName || 'User');

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-background-secondary border-l-2 border-discord-primary rounded-t-lg">
            {/* Curved line icon */}
            <CornerDownRight size={16} className="text-discord-primary flex-shrink-0" />

            {/* Reply info */}
            <div className="flex-1 min-w-0 flex items-center gap-1 text-sm">
                <span className="text-text-muted">Replying to</span>
                <span className="font-medium text-text-heading hover:underline cursor-pointer">
                    @{displayName}
                </span>
                <span className="text-text-muted truncate">
                    — {message.content.slice(0, 50)}{message.content.length > 50 ? '...' : ''}
                </span>
            </div>

            {/* Cancel button */}
            <button
                onClick={onCancel}
                className="p-1 text-text-muted hover:text-text-normal hover:bg-background-modifier-hover rounded transition-colors"
                title="Cancel reply"
            >
                <X size={16} />
            </button>
        </div>
    );
}
