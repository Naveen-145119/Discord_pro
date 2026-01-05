import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFriends } from '@/hooks/useFriends';
import { useDMs } from '@/hooks/useDMs';
import { AddFriendModal } from '@/components/modals/AddFriendModal';

import {
    Users,
    UserPlus,
    Clock,
    Check,
    X,
    UserMinus,
    Loader2,
    MessageCircle
} from 'lucide-react';
import { ProfilePopover } from '@/components/modals/ProfilePopover';
import { FriendsSidebar } from '@/components/layout/FriendsSidebar';

type FriendTab = 'all' | 'pending' | 'online';

export function HomePage() {
    const navigate = useNavigate();

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
    const { createOrGetDM } = useDMs();

    const [activeTab, setActiveTab] = useState<FriendTab>('all');
    const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedProfile, setSelectedProfile] = useState<{
        user: { displayName: string; avatarUrl?: string | null; username?: string; status?: string };
        position: { x: number; y: number };
        isCurrentUser: boolean;
    } | null>(null);

    const handleProfileClick = (e: React.MouseEvent, user: any, isCurrentUser: boolean = false) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedProfile({
            user: {
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                username: user.username,
                status: user.status
            },
            position: { x: e.clientX, y: e.clientY },
            isCurrentUser
        });
    };

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

    const handleMessage = async (friendId: string) => {
        setActionLoading(friendId);
        try {
            const dm = await createOrGetDM(friendId);
            navigate(`/dm/${dm.$id}`);
        } catch (err) {
            console.error('Failed to open DM:', err);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="flex flex-1 bg-background-primary">
            <FriendsSidebar />

            <div className="flex-1 flex flex-col">
                <div className="h-12 px-4 flex items-center gap-4 border-b border-background-tertiary shadow-elevation-low">
                    <Users size={24} className="text-interactive-muted" />
                    <span className="font-semibold text-text-heading">Friends</span>

                    <div className="h-6 w-px bg-background-tertiary mx-2" />

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

                    <button
                        onClick={() => setIsAddFriendModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
                    >
                        <UserPlus size={16} />
                        Add Friend
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 size={32} className="animate-spin text-interactive-muted" />
                        </div>
                    ) : (
                        <>
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
                                                    onMessage={() => handleMessage(friend.$id)}
                                                    isLoading={actionLoading === friend.$id}
                                                    onProfileClick={(e) => handleProfileClick(e, friend)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

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
                                                    onMessage={() => handleMessage(friend.$id)}
                                                    isLoading={actionLoading === friend.$id}
                                                    onProfileClick={(e) => handleProfileClick(e, friend)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'pending' && (
                                <div className="space-y-6">
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
                                                        <div className="avatar w-10 h-10 bg-discord-primary overflow-hidden">
                                                            {request?.sender?.avatarUrl ? (
                                                                <img src={request.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-sm font-medium text-white">
                                                                    {request?.sender?.displayName?.charAt(0) || '?'}
                                                                </span>
                                                            )}
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
                                                        <div className="avatar w-10 h-10 bg-discord-primary overflow-hidden">
                                                            {request?.receiver?.avatarUrl ? (
                                                                <img src={request.receiver.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-sm font-medium text-white">
                                                                    {request?.receiver?.displayName?.charAt(0) || '?'}
                                                                </span>
                                                            )}
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

            <AddFriendModal
                isOpen={isAddFriendModalOpen}
                onClose={() => setIsAddFriendModalOpen(false)}
                onSendRequest={sendRequest}
            />

            {selectedProfile && (
                <ProfilePopover
                    user={selectedProfile.user}
                    isOpen={!!selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                    isCurrentUser={selectedProfile.isCurrentUser}
                    position={selectedProfile.position}
                    onMessage={() => {
                        // Navigate to DM if not current user
                        if (!selectedProfile.isCurrentUser) {
                            // Find friend ID logic here - simplified for now
                            // handleMessage(selectedProfile.user.id);
                        }
                        setSelectedProfile(null);
                    }}
                />
            )}
        </div>
    );
}

interface FriendItemProps {
    friend: {
        $id: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
        status: string;
    };
    onRemove: () => void;
    onMessage: () => void;
    isLoading: boolean;
    onProfileClick: (e: React.MouseEvent) => void;
}

function FriendItem({ friend, onRemove, onMessage, isLoading, onProfileClick }: FriendItemProps) {
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
                <div
                    className="avatar w-10 h-10 bg-discord-primary overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={onProfileClick}
                >
                    {friend.avatarUrl ? (
                        <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-medium text-white">
                            {friend.displayName?.charAt(0) || '?'}
                        </span>
                    )}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background-primary ${getStatusColor(friend.status)}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-text-heading">{friend.displayName}</p>
                <p className="text-sm text-text-muted capitalize">{friend.status}</p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={onMessage}
                    disabled={isLoading}
                    className="p-2 rounded-full bg-background-tertiary hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover transition-colors disabled:opacity-50"
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
