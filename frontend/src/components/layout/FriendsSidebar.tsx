import { useNavigate, useParams } from 'react-router-dom';
import { useDMs } from '@/hooks/useDMs';
import { VoiceConnectionPanel } from '@/components/call';
import { UserArea } from './UserArea';
import { X } from 'lucide-react';

interface FriendsSidebarProps {
    /** Mobile only: whether the drawer is open */
    isOpen?: boolean;
    /** Mobile only: called when the user closes the drawer */
    onClose?: () => void;
}

export function FriendsSidebar({ isOpen, onClose }: FriendsSidebarProps) {
    const navigate = useNavigate();
    const { channelId } = useParams();
    const { dmChannels } = useDMs();

    const handleNavigate = (path: string) => {
        navigate(path);
        onClose?.();
    };

    const sidebarContent = (
        <div className="w-60 flex-shrink-0 flex flex-col bg-background-secondary h-full border-r border-background-tertiary">
            {/* Header */}
            <div className="h-12 px-2 flex items-center gap-2 shadow-elevation-low border-b border-background-tertiary">
                <button
                    onClick={() => handleNavigate('/')}
                    className="flex-1 text-left px-2 py-1 text-sm text-text-muted hover:bg-background-modifier-hover rounded truncate bg-background-tertiary"
                >
                    Find or start a conversation
                </button>
                {/* Close button — only visible on mobile */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="sm:hidden p-1 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded"
                        aria-label="Close sidebar"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-background-tertiary">
                <div className="mb-4">
                    <h2 className="px-2 mb-2 text-xs font-semibold text-text-muted uppercase hover:text-text-normal transition-colors cursor-pointer">
                        Direct Messages
                    </h2>
                    <div className="space-y-0.5">
                        {dmChannels.map((dm) => (
                            <button
                                key={dm.$id}
                                onClick={() => handleNavigate(`/dm/${dm.$id}`)}
                                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded group transition-colors ${channelId === dm.$id
                                        ? 'bg-background-modifier-selected text-text-heading'
                                        : 'text-text-muted hover:bg-background-modifier-hover hover:text-text-heading'
                                    }`}
                            >
                                <div className="relative">
                                    <div className="avatar w-8 h-8 bg-discord-primary overflow-hidden rounded-full font-medium flex items-center justify-center text-white flex-shrink-0">
                                        {dm.friend?.avatarUrl ? (
                                            <img src={dm.friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs">
                                                {dm.friend?.displayName?.charAt(0) || '?'}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background-secondary ${dm.friend?.status === 'online'
                                                ? 'bg-green-500'
                                                : dm.friend?.status === 'idle'
                                                    ? 'bg-yellow-500'
                                                    : 'bg-gray-500'
                                            }`}
                                    />
                                </div>
                                <span className="truncate font-medium">{dm.friend?.displayName || 'Unknown'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <VoiceConnectionPanel />
            <UserArea />
        </div>
    );

    return (
        <>
            {/* ── Desktop: static sidebar ───────────────────────────── */}
            <div className="hidden sm:flex h-full">
                {sidebarContent}
            </div>

            {/* ── Mobile: slide-in drawer ───────────────────────────── */}
            {isOpen !== undefined && (
                <div className={`sm:hidden fixed inset-0 z-40 flex transition-all duration-300 ${isOpen ? 'visible' : 'invisible'}`}>
                    {/* Backdrop */}
                    <div
                        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isOpen ? 'opacity-60' : 'opacity-0'}`}
                        onClick={onClose}
                    />
                    {/* Drawer */}
                    <div
                        className={`relative z-10 h-full flex transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                            }`}
                    >
                        {sidebarContent}
                    </div>
                </div>
            )}
        </>
    );
}
