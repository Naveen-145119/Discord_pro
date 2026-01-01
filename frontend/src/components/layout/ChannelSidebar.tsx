import { useNavigate, useLocation } from 'react-router-dom';
import {
    Hash,
    Volume2,
    ChevronDown,
    Settings,
    Plus,
    Mic,
    Headphones
} from 'lucide-react';
import type { Server, Channel } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface ChannelSidebarProps {
    server: Server;
    channels: Channel[];
}

/**
 * Channel sidebar for a server
 * Shows server name, channels organized by category
 */
export function ChannelSidebar({ server, channels }: ChannelSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();

    // Get current channel from URL
    const currentChannelId = location.pathname.match(/\/channels\/([^/]+)/)?.[1];

    // Organize channels by category
    const categories = channels.filter(c => c.type === 'category');
    const textChannels = channels.filter(c => c.type === 'text');
    const voiceChannels = channels.filter(c => c.type === 'voice');

    // Group channels by parent
    const channelsByParent = new Map<string | null, Channel[]>();
    [...textChannels, ...voiceChannels].forEach(channel => {
        const parentId = channel.parentId;
        if (!channelsByParent.has(parentId)) {
            channelsByParent.set(parentId, []);
        }
        channelsByParent.get(parentId)!.push(channel);
    });

    const handleChannelClick = (channel: Channel) => {
        navigate(`/servers/${server.$id}/channels/${channel.$id}`);
    };

    return (
        <div className="w-60 bg-background-secondary flex flex-col">
            {/* Server header */}
            <button className="h-12 px-4 flex items-center justify-between border-b border-background-tertiary shadow-elevation-low hover:bg-background-modifier-hover transition-colors">
                <span className="font-semibold text-text-heading truncate">
                    {server.name}
                </span>
                <ChevronDown size={18} className="text-interactive-normal flex-shrink-0" />
            </button>

            {/* Channels list */}
            <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
                {/* Channels without category */}
                {channelsByParent.get(null)?.map(channel => (
                    <ChannelItem
                        key={channel.$id}
                        channel={channel}
                        isActive={currentChannelId === channel.$id}
                        onClick={() => handleChannelClick(channel)}
                    />
                ))}

                {/* Categories with their channels */}
                {categories.map(category => (
                    <div key={category.$id} className="pt-4 first:pt-0">
                        <button className="flex items-center gap-1 px-1 py-1 w-full text-left group">
                            <ChevronDown size={12} className="text-channel-text" />
                            <span className="text-xs font-semibold text-channel-text uppercase tracking-wide truncate flex-1">
                                {category.name}
                            </span>
                            <Plus
                                size={16}
                                className="text-channel-text opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </button>

                        <div className="space-y-0.5 mt-1">
                            {channelsByParent.get(category.$id)?.map(channel => (
                                <ChannelItem
                                    key={channel.$id}
                                    channel={channel}
                                    isActive={currentChannelId === channel.$id}
                                    onClick={() => handleChannelClick(channel)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* User panel */}
            <div className="p-2 bg-background-secondary-alt">
                <div className="flex items-center gap-2 p-1 rounded hover:bg-background-modifier-hover">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="avatar w-8 h-8 bg-discord-primary">
                            <span className="text-xs font-medium text-white">
                                {user?.displayName?.charAt(0) || '?'}
                            </span>
                        </div>
                        {/* Status indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-status-online rounded-full border-[3px] border-background-secondary-alt" />
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-normal truncate">
                            {user?.displayName}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                            Online
                        </p>
                    </div>

                    {/* Voice controls */}
                    <div className="flex items-center gap-0.5">
                        <button
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="Mute"
                        >
                            <Mic size={18} />
                        </button>
                        <button
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="Deafen"
                        >
                            <Headphones size={18} />
                        </button>
                        <button
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="User Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Channel item component
function ChannelItem({
    channel,
    isActive,
    onClick
}: {
    channel: Channel;
    isActive: boolean;
    onClick: () => void;
}) {
    const Icon = channel.type === 'voice' ? Volume2 : Hash;

    return (
        <button
            onClick={onClick}
            className={`channel-item w-full mx-2 ${isActive ? 'active' : ''}`}
        >
            <Icon size={18} className="flex-shrink-0" />
            <span className="truncate">{channel.name}</span>
        </button>
    );
}
