import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFriends } from '@/hooks/useFriends';
import { AddFriendModal } from '@/components/modals/AddFriendModal';
import {
    Users,
    Settings,
    LogOut,
    UserPlus,
    Clock,
    Check,
    X,
    UserMinus,
    Loader2,
    MessageCircle
} from 'lucide-react';

type FriendTab = 'all' | 'pending' | 'online';

/**
 * Home page - shows DMs and friend list with full friend management
 */
export function HomePage() {
    const { user, logout } = useAuthStore();
    const {
        friends,
        pendingRequests,
        sentRequests,
        isLoading,
        sendRequest,
        acceptRequest,
        declineRequest,
        removeFriend
    } = useFriends();

    const [activeTab, setActiveTab] = useState<FriendTab>('all');
    const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const onlineFriends = friends.filter(f => f.status === 'online' || f.status === 'idle');
    const totalPending = pendingRequests.length + sentRequests.length;

    const handleAccept = async (requestId: string) => {
        setActionLoading(requestId);
        try {
            await acceptRequest(requestId);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDecline = async (requestId: string) => {
        setActionLoading(requestId);
        try {
            await declineRequest(requestId);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemove = async (friendId: string) => {
        setActionLoading(friendId);
        try {
            await removeFriend(friendId);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="flex flex-1 bg-background-primary">
            {/* DM Sidebar */}
            <div className="w-60 bg-background-secondary flex flex-col">
                {/* Search */}
                <div className="p-2">
                    <button className="w-full px-2 py-1.5 bg-background-tertiary rounded-md text-left text-text-muted text-sm">
                        Find or start a conversation
                    </button>
                </div>

                {/* Navigation */}
                <div className="px-2 space-y-0.5">
                    <button className="channel-item active w-full">
                        <Users size={20} />
                        <span>Friends</span>
                    </button>
                </div>

                {/* Direct Messages header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-1">
                    <span className="text-xs font-semibold text-channel-text uppercase">
                        Direct Messages
                    </span>
                    <button className="text-interactive-normal hover:text-interactive-hover">
                        +
                    </button>
                </div>

                {/* DM List - Empty state */}
                <div className="flex-1 px-2 py-2">
                    <p className="text-center text-text-muted text-sm py-8">
                        No direct messages yet
                    </p>
                </div>

                {/* User panel */}
                <div className="px-2 py-2 bg-background-secondary-alt">
                    <div className="flex items-center gap-2 p-1 rounded hover:bg-background-modifier-hover">
                        <div className="avatar w-8 h-8 bg-discord-primary">
                            <span className="text-xs font-medium text-white">
                                {user?.displayName?.charAt(0) || '?'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-normal truncate">
                                {user?.displayName}
                            </p>
                            <p className="text-xs text-text-muted truncate">
                                @{user?.username}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                                title="User Settings"
                            >
                                <Settings size={18} />
                            </button>
                            <button
                                onClick={logout}
                                className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-discord-red"
                                title="Log Out"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col">
                {/* Header with tabs */}
                <div className="h-12 px-4 flex items-center gap-4 border-b border-background-tertiary shadow-elevation-low">
                    <Users size={24} className="text-interactive-muted" />
                    <span className="font-semibold text-text-heading">Friends</span>

                    <div className="h-6 w-px bg-background-tertiary mx-2" />

                    {/* Tabs */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('online')}
                            className={`px-2 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'online'
                                    ? 'bg-background-modifier-selected text-text-heading'
                                    : 'text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover'
                                }`}
                        >
                            Online
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-2 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'all'
                                    ? 'bg-background-modifier-selected text-text-heading'
                                    : 'text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-2 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'pending'
                                    ? 'bg-background-modifier-selected text-text-heading'
                                    : 'text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover'
                                }`}
                        >
                            Pending
                            {totalPending > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-discord-red text-white text-xs rounded-full">
                                    {totalPending}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="flex-1" />

                    {/* Add Friend Button */}
                    <button
                        onClick={() => setIsAddFriendModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
                    >
                        <UserPlus size={16} />
                        Add Friend
                    </button>
                </div>

                {/* Friends content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 size={32} className="animate-spin text-interactive-muted" />
                        </div>
                    ) : (
                        <>
                            {/* Online Friends Tab */}
                            {activeTab === 'online' && (
                                <div>
                                    <h3 className="text-xs font-semibold text-channel-text uppercase mb-3">
                                        Online — {onlineFriends.length}
                                    </h3>
                                    {onlineFriends.length === 0 ? (
                                        <p className="text-text-muted text-sm">No friends online right now.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {onlineFriends.map((friend) => (
                                                <FriendItem
                                                    key={friend.$id}
                                                    friend={friend}
                                                    onRemove={() => handleRemove(friend.$id)}
                                                    isLoading={actionLoading === friend.$id}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* All Friends Tab */}
                            {activeTab === 'all' && (
                                <div>
                                    <h3 className="text-xs font-semibold text-channel-text uppercase mb-3">
                                        All Friends — {friends.length}
                                    </h3>
                                    {friends.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <MessageCircle size={64} className="text-interactive-muted mb-4" />
                                            <h3 className="text-lg font-semibold text-text-heading mb-2">
                                                No friends yet
                                            </h3>
                                            <p className="text-text-muted max-w-sm mb-4">
                                                Click the "Add Friend" button above to send friend requests!
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {friends.map((friend) => (
                                                <FriendItem
                                                    key={friend.$id}
                                                    friend={friend}
                                                    onRemove={() => handleRemove(friend.$id)}
                                                    isLoading={actionLoading === friend.$id}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Pending Requests Tab */}
                            {activeTab === 'pending' && (
                                <div className="space-y-6">
                                    {/* Incoming Requests */}
                                    {pendingRequests.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-channel-text uppercase mb-3">
                                                Incoming — {pendingRequests.length}
                                            </h3>
                                            <div className="space-y-1">
                                                {pendingRequests.map((request) => (
                                                    <div
                                                        key={request.$id}
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-background-modifier-hover group"
                                                    >
                                                        <div className="avatar w-10 h-10 bg-discord-primary">
                                                            <span className="text-sm font-medium text-white">
                                                                {request?.sender?.displayName?.charAt(0) || '?'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-text-heading">
                                                                {request?.sender?.displayName || 'Unknown'}
                                                            </p>
                                                            <p className="text-sm text-text-muted flex items-center gap-1">
                                                                <Clock size={12} />
                                                                Incoming Friend Request
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleAccept(request.$id)}
                                                                disabled={actionLoading === request.$id}
                                                                className="p-2 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
                                                                title="Accept"
                                                            >
                                                                {actionLoading === request.$id ? (
                                                                    <Loader2 size={16} className="animate-spin" />
                                                                ) : (
                                                                    <Check size={16} />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDecline(request.$id)}
                                                                disabled={actionLoading === request.$id}
                                                                className="p-2 rounded-full bg-background-tertiary hover:bg-red-600 text-interactive-normal hover:text-white transition-colors disabled:opacity-50"
                                                                title="Decline"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Outgoing Requests */}
                                    {sentRequests.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-channel-text uppercase mb-3">
                                                Outgoing — {sentRequests.length}
                                            </h3>
                                            <div className="space-y-1">
                                                {sentRequests.map((request) => (
                                                    <div
                                                        key={request.$id}
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-background-modifier-hover"
                                                    >
                                                        <div className="avatar w-10 h-10 bg-discord-primary">
                                                            <span className="text-sm font-medium text-white">
                                                                {request?.receiver?.displayName?.charAt(0) || '?'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-text-heading">
                                                                {request?.receiver?.displayName || 'Unknown'}
                                                            </p>
                                                            <p className="text-sm text-text-muted">
                                                                Outgoing Friend Request
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty state */}
                                    {pendingRequests.length === 0 && sentRequests.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <Clock size={64} className="text-interactive-muted mb-4" />
                                            <h3 className="text-lg font-semibold text-text-heading mb-2">
                                                No pending friend requests
                                            </h3>
                                            <p className="text-text-muted max-w-sm">
                                                When someone sends you a friend request, it will appear here.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Add Friend Modal */}
            <AddFriendModal
                isOpen={isAddFriendModalOpen}
                onClose={() => setIsAddFriendModalOpen(false)}
                onSendRequest={sendRequest}
            />
        </div>
    );
}

// Friend list item component
interface FriendItemProps {
    friend: {
        $id: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
        status: string;
    };
    onRemove: () => void;
    isLoading: boolean;
}

function FriendItem({ friend, onRemove, isLoading }: FriendItemProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'idle': return 'bg-yellow-500';
            case 'dnd': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-background-modifier-hover group">
            <div className="relative">
                <div className="avatar w-10 h-10 bg-discord-primary">
                    <span className="text-sm font-medium text-white">
                        {friend.displayName?.charAt(0) || '?'}
                    </span>
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background-primary ${getStatusColor(friend.status)}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-text-heading">{friend.displayName}</p>
                <p className="text-sm text-text-muted capitalize">{friend.status}</p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    className="p-2 rounded-full bg-background-tertiary hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover transition-colors"
                    title="Message"
                >
                    <MessageCircle size={16} />
                </button>
                <button
                    onClick={onRemove}
                    disabled={isLoading}
                    className="p-2 rounded-full bg-background-tertiary hover:bg-red-600 text-interactive-normal hover:text-white transition-colors disabled:opacity-50"
                    title="Remove Friend"
                >
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <UserMinus size={16} />
                    )}
                </button>
            </div>
        </div>
    );
}
