/**
 * ProfilePopover - Shows user profile when clicking on a participant
 * Used in call views to show participant details
 */
import { X, MessageCircle, Phone, Video } from 'lucide-react';

interface ProfilePopoverProps {
    user: {
        $id?: string;
        displayName: string;
        username?: string;
        avatarUrl?: string | null;
        status?: string;
        bio?: string;
    };
    isOpen: boolean;
    onClose: () => void;
    onMessage?: () => void;
    onVoiceCall?: () => void;
    onVideoCall?: () => void;
    onRemoveFriend?: () => void;
    isCurrentUser?: boolean;
    position?: { x: number; y: number };
}

export function ProfilePopover({
    user,
    isOpen,
    onClose,
    onMessage,
    onVoiceCall,
    onVideoCall,
    onRemoveFriend: _onRemoveFriend,
    isCurrentUser = false,
    position,
}: ProfilePopoverProps) {
    if (!isOpen) return null;

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'idle': return 'bg-yellow-500';
            case 'dnd': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusText = (status?: string) => {
        switch (status) {
            case 'online': return 'Online';
            case 'idle': return 'Idle';
            case 'dnd': return 'Do Not Disturb';
            default: return 'Offline';
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Popover */}
            <div
                className="fixed z-50 w-80 bg-[#232428] rounded-lg shadow-xl border border-[#1e1f22] overflow-hidden"
                style={{
                    left: position?.x ?? '50%',
                    top: position?.y ?? '50%',
                    transform: position ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
                }}
            >
                {/* Banner */}
                <div className="h-16 bg-gradient-to-r from-discord-primary to-purple-600" />

                {/* Profile Info */}
                <div className="relative px-4 pb-4">
                    {/* Avatar */}
                    <div className="absolute -top-10 left-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full border-4 border-[#232428] bg-discord-primary flex items-center justify-center overflow-hidden">
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={user.displayName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-2xl font-bold text-white">
                                        {user.displayName?.charAt(0) || '?'}
                                    </span>
                                )}
                            </div>
                            <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-[#232428] ${getStatusColor(user.status)}`} />
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                        <X size={18} />
                    </button>

                    {/* Name and Status */}
                    <div className="pt-12 space-y-3">
                        <div>
                            <h3 className="text-xl font-bold text-white">
                                {user.displayName}
                            </h3>
                            {user.username && (
                                <p className="text-sm text-gray-400">
                                    @{user.username}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(user.status)}`} />
                            <span className="text-gray-300">{getStatusText(user.status)}</span>
                        </div>

                        {/* Bio */}
                        {user.bio && (
                            <div className="pt-2 border-t border-[#1e1f22]">
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    {user.bio}
                                </p>
                            </div>
                        )}

                        {/* Actions (only show if not current user) */}
                        {!isCurrentUser && (
                            <div className="pt-3 flex items-center gap-2">
                                {onMessage && (
                                    <button
                                        onClick={onMessage}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-discord-primary hover:bg-discord-primary/80 text-white text-sm font-medium rounded transition-colors"
                                    >
                                        <MessageCircle size={16} />
                                        Message
                                    </button>
                                )}
                                {onVoiceCall && (
                                    <button
                                        onClick={onVoiceCall}
                                        className="p-2 bg-[#383a40] hover:bg-[#404249] text-gray-300 hover:text-white rounded transition-colors"
                                        title="Voice Call"
                                    >
                                        <Phone size={18} />
                                    </button>
                                )}
                                {onVideoCall && (
                                    <button
                                        onClick={onVideoCall}
                                        className="p-2 bg-[#383a40] hover:bg-[#404249] text-gray-300 hover:text-white rounded transition-colors"
                                        title="Video Call"
                                    >
                                        <Video size={18} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
