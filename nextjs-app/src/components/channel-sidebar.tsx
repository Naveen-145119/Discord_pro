'use client';

import { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Channel, Server } from '@/types';
import { Hash, Volume2, ChevronDown } from 'lucide-react';

interface ChannelSidebarProps {
    server: Server;
    channels: Channel[];
}

// Channel Sidebar component (Blueprint Section 6.1)
export function ChannelSidebar({ server, channels }: ChannelSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    const currentChannelId = pathname.match(/\/channels\/([^/]+)/)?.[1];

    // Group channels by category
    const groupedChannels = useMemo(() => {
        const categories = channels.filter(c => c.type === 'category');
        const nonCategoryChannels = channels.filter(c => c.type !== 'category');

        const groups: { category: Channel | null; channels: Channel[] }[] = [];

        // Channels without category
        const orphans = nonCategoryChannels.filter(c => !c.parentId);
        if (orphans.length > 0) {
            groups.push({ category: null, channels: orphans });
        }

        // Channels grouped by category
        categories.forEach(cat => {
            const children = nonCategoryChannels.filter(c => c.parentId === cat.$id);
            groups.push({ category: cat, channels: children });
        });

        return groups;
    }, [channels]);

    const handleChannelClick = (channel: Channel) => {
        if (channel.type === 'text') {
            router.push(`/servers/${server.$id}/channels/${channel.$id}`);
        } else if (channel.type === 'voice') {
            // Voice channel - would trigger voice connect
            router.push(`/servers/${server.$id}/channels/${channel.$id}`);
        }
    };

    return (
        <div className="w-60 bg-[#2B2D31] flex flex-col h-full">
            {/* Server Header */}
            <button className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 shadow-sm hover:bg-[#35373C] transition-colors">
                <h2 className="font-semibold text-[#F2F3F5] truncate">
                    {server.name}
                </h2>
                <ChevronDown size={16} className="text-[#949BA4]" />
            </button>

            {/* Channel List */}
            <div className="flex-1 px-2 py-4 overflow-y-auto thin-scrollbar">
                {groupedChannels.map((group, groupIndex) => (
                    <div key={group.category?.$id || `orphan-${groupIndex}`} className="mb-4">
                        {/* Category Header */}
                        {group.category && (
                            <button className="flex items-center gap-1 px-1 mb-1 text-[#949BA4] hover:text-[#DBDEE1] cursor-pointer w-full">
                                <ChevronDown size={12} />
                                <span className="text-xs font-semibold uppercase truncate">
                                    {group.category.name}
                                </span>
                            </button>
                        )}

                        {/* Channels in Group */}
                        {group.channels.map((channel) => {
                            const isActive = currentChannelId === channel.$id;
                            const Icon = channel.type === 'voice' ? Volume2 : Hash;

                            return (
                                <button
                                    key={channel.$id}
                                    onClick={() => handleChannelClick(channel)}
                                    className={`channel-item w-full ${isActive ? 'active' : ''}`}
                                >
                                    <Icon size={20} className={isActive ? 'text-[#DBDEE1]' : 'text-[#949BA4]'} />
                                    <span className={`text-sm truncate ${isActive ? 'text-white' : ''}`}>
                                        {channel.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}

                {channels.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-[#949BA4] text-sm">No channels yet</p>
                    </div>
                )}
            </div>

            {/* User Panel */}
            <UserPanel />
        </div>
    );
}

// User panel at bottom of sidebar
function UserPanel() {
    const { user, logout } = useAuthStore();

    if (!user) return null;

    return (
        <div className="h-[52px] bg-[#232428] px-2 flex items-center">
            {/* Avatar */}
            <div className="relative">
                <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        user.username?.charAt(0).toUpperCase() || 'U'
                    )}
                </div>
                {/* Status indicator */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#232428] ${user.status === 'online' ? 'bg-[#23A55A]' :
                        user.status === 'idle' ? 'bg-[#F0B232]' :
                            user.status === 'dnd' ? 'bg-[#F23F43]' : 'bg-[#80848E]'
                    }`} />
            </div>

            {/* User info */}
            <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F2F3F5] truncate">
                    {user.displayName || user.username}
                </p>
                <p className="text-xs text-[#949BA4] truncate capitalize">
                    {user.status}
                </p>
            </div>

            {/* Settings/Logout */}
            <button
                onClick={() => logout()}
                className="p-1.5 text-[#949BA4] hover:text-[#DBDEE1] hover:bg-[#35373C] rounded"
                title="Logout"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.63 8.4a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.64-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
            </button>
        </div>
    );
}

import { useAuthStore } from '@/stores/auth-store';
