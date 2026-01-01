import { useAuthStore } from '@/stores/authStore';
import { MessageCircle, Users, Settings, LogOut } from 'lucide-react';

/**
 * Home page - shown when no server is selected
 * Shows DMs and friend list
 */
export function HomePage() {
    const { user, logout } = useAuthStore();

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
                        {/* Avatar */}
                        <div className="avatar w-8 h-8 bg-discord-primary">
                            <span className="text-xs font-medium text-white">
                                {user?.displayName?.charAt(0) || '?'}
                            </span>
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-normal truncate">
                                {user?.displayName}
                            </p>
                            <p className="text-xs text-text-muted truncate">
                                @{user?.username}
                            </p>
                        </div>

                        {/* Actions */}
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
                {/* Header */}
                <div className="h-12 px-4 flex items-center border-b border-background-tertiary shadow-elevation-low">
                    <Users size={24} className="text-interactive-muted" />
                    <span className="ml-2 font-semibold text-text-heading">Friends</span>
                </div>

                {/* Friends content - Empty state */}
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <MessageCircle size={64} className="text-interactive-muted mb-4" />
                    <h3 className="text-lg font-semibold text-text-heading mb-2">
                        No friends yet
                    </h3>
                    <p className="text-text-muted max-w-sm">
                        When you have friends, they'll appear here. Start by joining a server or adding friends!
                    </p>
                </div>
            </div>
        </div>
    );
}
