import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import {
    Smile,
    Reply,
    Pencil,
    Trash2,
    MoreHorizontal,
    Phone,
    Video,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    PhoneOff,
    X,
    Check
} from 'lucide-react';
import { MessageContextMenu } from './MessageContextMenu';
import type { Message, User, CallLogMetadata } from '@/types';

interface MessageItemProps {
    message: Message;
    isHeader: boolean;
    isOwnMessage: boolean;
    friend?: User | null;
    onReply?: (message: Message) => void;
    onEdit?: (message: Message) => void;
    onEditSave?: (messageId: string, content: string) => Promise<void>;
    onDelete?: (message: Message) => void;
    onReaction?: (message: Message, emoji: string) => void;
    onStartCall?: (type: 'voice' | 'video') => void;
}

function formatHoverTime(dateString: string): string {
    return format(new Date(dateString), 'h:mm a');
}

function formatFullTime(dateString: string): string {
    return format(new Date(dateString), 'MM/dd/yyyy h:mm a');
}

export function MessageItem({
    message,
    isHeader,
    isOwnMessage,
    friend,
    onReply,
    onEdit,
    onEditSave,
    onDelete,
    onReaction,
    onStartCall,
}: MessageItemProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [showQuickReactions, setShowQuickReactions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.selectionStart = textareaRef.current.value.length;
        }
    }, [isEditing]);

    // Handle edit save
    const handleSaveEdit = async () => {
        if (!editContent.trim() || editContent === message.content) {
            setIsEditing(false);
            setEditContent(message.content);
            return;
        }

        setIsSaving(true);
        try {
            if (onEditSave) {
                await onEditSave(message.$id, editContent.trim());
            }
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to save edit:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle edit cancel
    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditContent(message.content);
    };

    // Handle keyboard shortcuts in edit mode
    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    // Handle edit click from toolbar or context menu
    const handleEditClick = (msg: Message) => {
        setIsEditing(true);
        setEditContent(msg.content);
        onEdit?.(msg);
    };

    // Handle call log messages
    if (message.type === 'call') {
        return (
            <CallLogMessage
                message={message}
                isOwnMessage={isOwnMessage}
                onStartCall={onStartCall}
            />
        );
    }

    const displayName = isOwnMessage ? 'You' : (friend?.displayName || 'User');
    const avatarInitial = isOwnMessage ? 'Y' : (friend?.displayName?.charAt(0) || '?');
    const avatarUrl = isOwnMessage ? null : friend?.avatarUrl;

    return (
        <MessageContextMenu
            message={message}
            isOwnMessage={isOwnMessage}
            onReply={onReply}
            onEdit={handleEditClick}
            onDelete={onDelete}
        >
            <div
                className={twMerge(
                    'relative px-4 group',
                    isHeader ? 'mt-4 pt-1' : 'mt-0.5',
                    isHovered && 'bg-black/[0.02] dark:bg-white/[0.02]'
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                    setIsHovered(false);
                    setShowQuickReactions(false);
                }}
            >
                {/* Hover timestamp for grouped messages */}
                {!isHeader && !isEditing && (
                    <span
                        className={twMerge(
                            'absolute left-0 top-1/2 -translate-y-1/2 w-[52px] text-[10px] text-text-muted text-right pr-1',
                            'opacity-0 group-hover:opacity-100 transition-opacity duration-100'
                        )}
                    >
                        {formatHoverTime(message.$createdAt)}
                    </span>
                )}

                <div className="flex gap-4">
                    {/* Avatar column */}
                    <div className="w-10 flex-shrink-0">
                        {isHeader ? (
                            <div className="w-10 h-10 rounded-full bg-discord-primary flex items-center justify-center overflow-hidden">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-medium text-white">
                                        {avatarInitial}
                                    </span>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* Content column */}
                    <div className="flex-1 min-w-0">
                        {/* Header with name and timestamp */}
                        {isHeader && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="font-medium text-text-heading hover:underline cursor-pointer">
                                    {displayName}
                                </span>
                                <span className="text-xs text-text-muted">
                                    {formatFullTime(message.$createdAt)}
                                </span>
                            </div>
                        )}

                        {/* Message content - editable or static */}
                        {isEditing ? (
                            <div className="space-y-2">
                                <textarea
                                    ref={textareaRef}
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    disabled={isSaving}
                                    className="w-full p-2 bg-background-tertiary text-text-normal rounded resize-none focus:outline-none focus:ring-2 focus:ring-discord-primary min-h-[60px]"
                                    rows={2}
                                />
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-text-muted">
                                        escape to <button onClick={handleCancelEdit} className="text-discord-link hover:underline">cancel</button>
                                        {' • '}
                                        enter to <button onClick={handleSaveEdit} className="text-discord-link hover:underline">save</button>
                                    </span>
                                    <div className="flex-1" />
                                    <button
                                        onClick={handleCancelEdit}
                                        className="p-1 text-text-muted hover:text-text-normal hover:bg-background-modifier-hover rounded transition-colors"
                                        title="Cancel"
                                    >
                                        <X size={16} />
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSaving || !editContent.trim()}
                                        className="p-1 text-discord-primary hover:text-discord-primary/80 hover:bg-background-modifier-hover rounded transition-colors disabled:opacity-50"
                                        title="Save"
                                    >
                                        <Check size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className={twMerge(
                                'text-text-normal whitespace-pre-wrap break-words',
                                !isHeader && 'pl-0'
                            )}>
                                {message.content}
                                {message.isEdited && (
                                    <span className="text-[10px] text-text-muted ml-1">(edited)</span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* Message Action Toolbar */}
                {isHovered && !isEditing && (
                    <MessageToolbar
                        message={message}
                        isOwnMessage={isOwnMessage}
                        onReply={onReply}
                        onEdit={handleEditClick}
                        onDelete={onDelete}
                        onReaction={onReaction}
                        showQuickReactions={showQuickReactions}
                        setShowQuickReactions={setShowQuickReactions}
                    />
                )}
            </div>
        </MessageContextMenu>
    );
}

function MessageToolbar({
    message,
    isOwnMessage,
    onReply,
    onEdit,
    onDelete,
    onReaction,
    showQuickReactions,
    setShowQuickReactions,
}: {
    message: Message;
    isOwnMessage: boolean;
    onReply?: (message: Message) => void;
    onEdit?: (message: Message) => void;
    onDelete?: (message: Message) => void;
    onReaction?: (message: Message, emoji: string) => void;
    showQuickReactions: boolean;
    setShowQuickReactions: (show: boolean) => void;
}) {
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

    return (
        <div className="absolute -top-4 right-4 flex items-center bg-background-secondary border border-background-tertiary rounded shadow-lg overflow-hidden z-10">
            {showQuickReactions && (
                <div className="flex items-center gap-0.5 px-1 border-r border-background-tertiary">
                    {quickReactions.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => {
                                onReaction?.(message, emoji);
                                setShowQuickReactions(false);
                            }}
                            className="p-1 text-lg hover:bg-background-modifier-hover rounded transition-colors"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center">
                <ToolbarButton
                    icon={<Smile size={18} />}
                    tooltip="Add Reaction"
                    onClick={() => setShowQuickReactions(!showQuickReactions)}
                />
                <ToolbarButton
                    icon={<Reply size={18} />}
                    tooltip="Reply"
                    onClick={() => onReply?.(message)}
                />
                {isOwnMessage && (
                    <ToolbarButton
                        icon={<Pencil size={18} />}
                        tooltip="Edit"
                        onClick={() => onEdit?.(message)}
                    />
                )}
                {isOwnMessage && (
                    <ToolbarButton
                        icon={<Trash2 size={18} />}
                        tooltip="Delete"
                        onClick={() => onDelete?.(message)}
                        danger
                    />
                )}
                <ToolbarButton
                    icon={<MoreHorizontal size={18} />}
                    tooltip="More"
                    onClick={() => { }}
                />
            </div>
        </div>
    );
}

function ToolbarButton({
    icon,
    tooltip,
    onClick,
    danger = false,
}: {
    icon: React.ReactNode;
    tooltip: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={twMerge(
                'p-2 transition-colors',
                danger
                    ? 'text-danger hover:bg-danger/10 hover:text-danger'
                    : 'text-interactive-normal hover:bg-background-modifier-hover hover:text-interactive-hover'
            )}
            title={tooltip}
        >
            {icon}
        </button>
    );
}

function CallLogMessage({
    message,
    isOwnMessage,
    onStartCall,
}: {
    message: Message;
    isOwnMessage: boolean;
    onStartCall?: (type: 'voice' | 'video') => void;
}) {
    let callMetadata: CallLogMetadata | null = null;
    try {
        if (message.metadata) {
            callMetadata = JSON.parse(message.metadata) as CallLogMetadata;
        }
    } catch {
        return null;
    }

    if (!callMetadata) return null;

    const isOutgoing = callMetadata.callerId === message.authorId && isOwnMessage;
    const isVideoCall = callMetadata.callType === 'video';

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    let CallIcon = Phone;
    let iconColor = 'text-green-500';
    let statusText = '';
    let statusColor = 'text-text-muted';

    switch (callMetadata.callStatus) {
        case 'ended':
            CallIcon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
            iconColor = 'text-green-500';
            statusText = isOutgoing ? 'Outgoing call' : 'Incoming call';
            if (callMetadata.duration) {
                statusText += ` • ${formatDuration(callMetadata.duration)}`;
            }
            break;
        case 'missed':
            CallIcon = PhoneMissed;
            iconColor = 'text-red-500';
            statusText = isOutgoing ? 'Call not answered' : 'Missed call';
            statusColor = 'text-red-400';
            break;
        case 'declined':
            CallIcon = PhoneOff;
            iconColor = 'text-red-500';
            statusText = isOutgoing ? 'Call declined' : 'You declined';
            statusColor = 'text-red-400';
            break;
        default:
            statusText = 'Call';
    }

    return (
        <div className="flex gap-4 px-4 py-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
            <div className={twMerge(
                'w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center',
                callMetadata.callStatus === 'ended' ? 'bg-green-500/20' : 'bg-red-500/20'
            )}>
                <CallIcon size={20} className={iconColor} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-heading">
                        {isVideoCall ? 'Video Call' : 'Voice Call'}
                    </span>
                    <span className={`text-sm ${statusColor}`}>
                        {statusText}
                    </span>
                    <span className="text-xs text-text-muted">
                        {format(new Date(message.$createdAt), 'h:mm a')}
                    </span>
                </div>

                {onStartCall && (
                    <button
                        onClick={() => onStartCall(callMetadata!.callType)}
                        className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-background-secondary hover:bg-background-modifier-hover rounded text-sm text-text-normal transition-colors"
                    >
                        {isVideoCall ? <Video size={14} /> : <Phone size={14} />}
                        Call Back
                    </button>
                )}
            </div>
        </div>
    );
}
