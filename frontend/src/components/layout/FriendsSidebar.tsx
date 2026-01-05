import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useDMs } from '@/hooks/useDMs';
import { useSettingsStore } from '@/stores/settingsStore';
import { VoiceConnectionPanel } from '@/components/call';
import { ProfilePopover } from '@/components/modals/ProfilePopover';
import { Settings, LogOut } from 'lucide-react';

export function FriendsSidebar() {
    const navigate = useNavigate();
    const { channelId } = useParams();
    const { user, logout } = useAuthStore();
    const { dmChannels } = useDMs();
    const { openSettings } = useSettingsStore();

    const [selectedProfile, setSelectedProfile] = useState<{
        user: { displayName: string; avatarUrl?: string | null; username?: string; status?: string };
        position: { x: number; y: number };
        isCurrentUser: boolean;
    } | null>(null);

    const handleProfileClick = (e: React.MouseEvent, targetUser: any, isCurrentUser: boolean = false) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedProfile({
            user: {
                displayName: targetUser.displayName,
                avatarUrl: targetUser.avatarUrl,
                username: targetUser.username,
                status: targetUser.status
            },
            position: { x: e.clientX, y: e.clientY },
            isCurrentUser
        });
    };

    return (
        <div className="w-60 flex-shrink-0 flex flex-col bg-background-secondary h-full border-r border-background-tertiary">
            <div className="h-12 px-2 flex items-center shadow-elevation-low border-b border-background-tertiary">
                <button
                    onClick={() => navigate('/')}
                    className="w-full text-left px-2 py-1 text-sm text-text-muted hover:bg-background-modifier-hover rounded truncate bg-background-tertiary"
                >
                    Find or start a conversation
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-background-tertiary">
                {/* DM Channels */}
                <div className="mb-4">
                    <h2 className="px-2 mb-2 text-xs font-semibold text-text-muted uppercase hover:text-text-normal transition-colors cursor-pointer">
                        Direct Messages
                    </h2>
                    <div className="space-y-0.5">
                        {dmChannels.map((dm) => (
                            <button
                                key={dm.$id}
                                onClick={() => navigate(`/dm/${dm.$id}`)}
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
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background-secondary ${dm.friend?.status === 'online' ? 'bg-green-500' :
                                        dm.friend?.status === 'idle' ? 'bg-yellow-500' :
                                            'bg-gray-500'
                                        }`} />
                                </div>
                                <span className="truncate font-medium">{dm.friend?.displayName || 'Unknown'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <VoiceConnectionPanel />

            {/* Current User */}
            <div className="px-2 py-2 bg-background-secondary-alt flex-shrink-0">
                <div className="flex items-center gap-2 p-1 rounded hover:bg-background-modifier-hover group">
                    <div
                        className="avatar w-8 h-8 bg-discord-primary overflow-hidden cursor-pointer hover:opacity-80 transition-opacity rounded-full flex items-center justify-center flex-shrink-0"
                        onClick={(e) => user && handleProfileClick(e, user, true)}
                    >
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-medium text-white">
                                {user?.displayName?.charAt(0) || '?'}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-normal truncate">
                            {user?.displayName}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                            #{user?.username || '0000'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="User Settings"
                            onClick={() => openSettings()}
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

            {selectedProfile && (
                <ProfilePopover
                    user={selectedProfile.user}
                    isOpen={!!selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                    isCurrentUser={selectedProfile.isCurrentUser}
                    position={selectedProfile.position}
                    onMessage={() => {
                        setSelectedProfile(null);
                    }}
                />
            )}
        </div>
    );
}
