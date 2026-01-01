import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { Plus, Compass, Download, MessageCircle } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { CreateServerModal } from '@/components/modals/CreateServerModal';

/**
 * Server sidebar - leftmost column
 * Shows list of servers, DMs button, and create server button
 */
export function ServerSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { servers, fetchServers } = useServerStore();
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Fetch servers on mount
    useEffect(() => {
        if (user?.$id) {
            fetchServers(user.$id);
        }
    }, [user?.$id, fetchServers]);

    // Parse current server from URL
    const currentServerId = location.pathname.match(/\/servers\/([^/]+)/)?.[1];
    const isHome = location.pathname === '/';

    return (
        <>
            <nav className="w-[72px] bg-background-tertiary flex flex-col items-center py-3 gap-2 overflow-y-auto no-select">
                {/* Home / DMs button */}
                <button
                    onClick={() => navigate('/')}
                    className={`server-icon ${isHome ? 'active' : ''} group relative`}
                    title="Direct Messages"
                >
                    <MessageCircle
                        size={24}
                        className={isHome ? 'text-white' : 'text-interactive-normal group-hover:text-white'}
                    />

                    {/* Active indicator */}
                    {isHome && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[8px] w-1 h-10 bg-white rounded-r-full" />
                    )}
                </button>

                {/* Divider */}
                <div className="w-8 h-0.5 bg-background-modifier-active rounded-full" />

                {/* Server list */}
                {servers.map((server) => {
                    const isActive = currentServerId === server.$id;

                    return (
                        <button
                            key={server.$id}
                            onClick={() => navigate(`/servers/${server.$id}`)}
                            className={`server-icon ${isActive ? 'active' : ''} group relative`}
                            title={server.name}
                        >
                            {server.iconUrl ? (
                                <img
                                    src={server.iconUrl}
                                    alt={server.name}
                                    className="w-full h-full object-cover rounded-[inherit]"
                                />
                            ) : (
                                <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-interactive-normal group-hover:text-white'}`}>
                                    {getInitials(server.name)}
                                </span>
                            )}

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

                {/* Add server button */}
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="server-icon group !bg-transparent border-2 border-dashed border-interactive-muted hover:border-discord-green hover:!bg-transparent"
                    title="Add a Server"
                >
                    <Plus
                        size={24}
                        className="text-discord-green"
                    />
                </button>

                {/* Explore servers */}
                <button
                    className="server-icon group hover:!bg-discord-green"
                    title="Explore Discoverable Servers"
                >
                    <Compass
                        size={24}
                        className="text-discord-green group-hover:text-white"
                    />
                </button>

                {/* Divider */}
                <div className="w-8 h-0.5 bg-background-modifier-active rounded-full" />

                {/* Download apps */}
                <button
                    className="server-icon group hover:!bg-discord-green"
                    title="Download Apps"
                >
                    <Download
                        size={24}
                        className="text-discord-green group-hover:text-white"
                    />
                </button>
            </nav>

            {/* Create Server Modal */}
            {showCreateModal && (
                <CreateServerModal onClose={() => setShowCreateModal(false)} />
            )}
        </>
    );
}
