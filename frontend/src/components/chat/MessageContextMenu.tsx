import * as ContextMenu from '@radix-ui/react-context-menu';
import { Reply, Pencil, Copy, Trash2, Hash } from 'lucide-react';
import type { Message } from '@/types';

interface MessageContextMenuProps {
    children: React.ReactNode;
    message: Message;
    isOwnMessage: boolean;
    onReply?: (message: Message) => void;
    onEdit?: (message: Message) => void;
    onDelete?: (message: Message) => void;
    onCopyText?: (text: string) => void;
    onCopyId?: (id: string) => void;
}

export function MessageContextMenu({
    children,
    message,
    isOwnMessage,
    onReply,
    onEdit,
    onDelete,
    onCopyText,
    onCopyId,
}: MessageContextMenuProps) {
    const handleCopyText = () => {
        navigator.clipboard.writeText(message.content);
        onCopyText?.(message.content);
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(message.$id);
        onCopyId?.(message.$id);
    };

    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
                {children}
            </ContextMenu.Trigger>

            <ContextMenu.Portal>
                <ContextMenu.Content
                    className="min-w-[200px] bg-[#111214] rounded-md p-1.5 shadow-lg border border-white/5 z-50"
                >
                    {/* Reply */}
                    <ContextMenu.Item
                        className="flex items-center gap-3 px-2 py-1.5 text-sm text-text-normal rounded hover:bg-discord-primary hover:text-white cursor-pointer outline-none"
                        onSelect={() => onReply?.(message)}
                    >
                        <Reply size={16} />
                        Reply
                    </ContextMenu.Item>

                    {/* Edit (own messages only) */}
                    {isOwnMessage && (
                        <ContextMenu.Item
                            className="flex items-center gap-3 px-2 py-1.5 text-sm text-text-normal rounded hover:bg-discord-primary hover:text-white cursor-pointer outline-none"
                            onSelect={() => onEdit?.(message)}
                        >
                            <Pencil size={16} />
                            Edit Message
                        </ContextMenu.Item>
                    )}

                    <ContextMenu.Separator className="h-px my-1 bg-white/10" />

                    {/* Copy Text */}
                    <ContextMenu.Item
                        className="flex items-center gap-3 px-2 py-1.5 text-sm text-text-normal rounded hover:bg-discord-primary hover:text-white cursor-pointer outline-none"
                        onSelect={handleCopyText}
                    >
                        <Copy size={16} />
                        Copy Text
                    </ContextMenu.Item>

                    {/* Copy ID */}
                    <ContextMenu.Item
                        className="flex items-center gap-3 px-2 py-1.5 text-sm text-text-muted rounded hover:bg-discord-primary hover:text-white cursor-pointer outline-none"
                        onSelect={handleCopyId}
                    >
                        <Hash size={16} />
                        Copy Message ID
                    </ContextMenu.Item>

                    {/* Delete (own messages only) */}
                    {isOwnMessage && (
                        <>
                            <ContextMenu.Separator className="h-px my-1 bg-white/10" />
                            <ContextMenu.Item
                                className="flex items-center gap-3 px-2 py-1.5 text-sm text-danger rounded hover:bg-danger hover:text-white cursor-pointer outline-none"
                                onSelect={() => onDelete?.(message)}
                            >
                                <Trash2 size={16} />
                                Delete Message
                            </ContextMenu.Item>
                        </>
                    )}
                </ContextMenu.Content>
            </ContextMenu.Portal>
        </ContextMenu.Root>
    );
}
