'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useServerStore } from '@/stores/server-store';
import { Plus, Compass, Download, MessageCircle } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export function ServerSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuthStore();
    const { servers, fetchServers } = useServerStore();
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (user?.$id) {
            fetchServers(user.$id);
        }
    }, [user?.$id, fetchServers]);

    const currentServerId = pathname.match(/\/servers\/([^/]+)/)?.[1];
    const isHome = pathname === '/';

    return (
        <>
            <nav className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 overflow-y-auto no-select thin-scrollbar">
                {/* Home / DMs Button */}
                <button
                    onClick={() => router.push('/')}
                    className={`server-icon ${isHome ? 'active' : ''} group relative`}
                    title="Direct Messages"
                >
                    <MessageCircle
                        size={24}
                        className={isHome ? 'text-white' : 'text-[#949BA4] group-hover:text-white'}
                    />

                    {/* Active indicator pill */}
                    {isHome && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[8px] w-1 h-10 bg-white rounded-r-full" />
                    )}
                </button>

                {/* Separator */}
                <div className="w-8 h-0.5 bg-[#35363C] rounded-full" />

                {/* Server Icons */}
                {servers.map((server) => {
                    const isActive = currentServerId === server.$id;

                    return (
                        <button
                            key={server.$id}
                            onClick={() => router.push(`/servers/${server.$id}`)}
                            className={`server-icon ${isActive ? 'active' : ''} group relative`}
                            title={server.name}
                        >
                            {server.iconUrl ? (
                                <img
                                    src={server.iconUrl}
                                    alt={server.name}
                                    className="w-full h-full object-cover rounded-[inherit]"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                            ) : null}
                            <span className={`text-sm font-medium ${server.iconUrl ? 'hidden' : ''} ${isActive ? 'text-white' : 'text-[#949BA4] group-hover:text-white'}`}>
                                {getInitials(server.name)}
                            </span>

                            {/* Active indicator */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[8px] w-1 h-10 bg-white rounded-r-full" />
                            )}

                            {/* Hover indicator */}
                            {!isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[8px] w-1 h-5 bg-white rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </button>
                    );
                })}

                {/* Add Server Button */}
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="server-icon group !bg-transparent border-2 border-dashed border-[#3F4147] hover:border-[#57F287] hover:!bg-transparent"
                    title="Add a Server"
                >
                    <Plus
                        size={24}
                        className="text-[#57F287]"
                    />
                </button>

                {/* Explore Servers */}
                <button
                    className="server-icon group hover:!bg-[#57F287]"
                    title="Explore Discoverable Servers"
                >
                    <Compass
                        size={24}
                        className="text-[#57F287] group-hover:text-white"
                    />
                </button>

                <div className="w-8 h-0.5 bg-[#35363C] rounded-full" />

                {/* Download Apps */}
                <button
                    className="server-icon group hover:!bg-[#57F287]"
                    title="Download Apps"
                >
                    <Download
                        size={24}
                        className="text-[#57F287] group-hover:text-white"
                    />
                </button>
            </nav>

            {/* Create Server Modal - to be implemented */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#313338] rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-[#F2F3F5] mb-4">Create a Server</h2>
                        <p className="text-[#949BA4] mb-4">
                            Give your server a name and an icon. You can always change these later.
                        </p>
                        <input
                            type="text"
                            placeholder="Server name"
                            className="input-field w-full mb-4"
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button className="btn-primary">
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
