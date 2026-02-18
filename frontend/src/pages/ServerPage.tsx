import { useEffect, useState } from 'react';
import { useParams, useNavigate, Routes, Route } from 'react-router-dom';
import { useServerStore } from '@/stores/serverStore';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChannelPage } from './ChannelPage';
import { Hash, Menu } from 'lucide-react';

export function ServerPage() {
    const { serverId } = useParams<{ serverId: string }>();
    const navigate = useNavigate();
    const { currentServer, channels, fetchServerDetails, isLoading } = useServerStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (serverId) {
            fetchServerDetails(serverId);
        }
    }, [serverId, fetchServerDetails]);

    useEffect(() => {
        if (currentServer?.defaultChannelId && window.location.pathname === `/servers/${serverId}`) {
            navigate(`/servers/${serverId}/channels/${currentServer.defaultChannelId}`, { replace: true });
        }
    }, [currentServer, serverId, navigate]);

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center bg-background-primary">
                <div className="w-8 h-8 border-4 border-discord-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!currentServer) {
        return (
            <div className="flex flex-1 items-center justify-center bg-background-primary">
                <p className="text-text-muted">Server not found</p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 bg-background-primary overflow-hidden">
            {/* Channel Sidebar — drawer on mobile, static on desktop */}
            <ChannelSidebar
                server={currentServer}
                channels={channels}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Mobile header with hamburger to open channel sidebar */}
                <div className="sm:hidden h-12 px-3 flex items-center gap-3 border-b border-background-tertiary bg-background-primary shadow-elevation-low flex-shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-1.5 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded"
                        aria-label="Open channels"
                    >
                        <Menu size={20} />
                    </button>
                    <span className="font-semibold text-text-heading truncate">{currentServer.name}</span>
                </div>

                <Routes>
                    <Route path="channels/:channelId" element={<ChannelPage />} />
                    <Route
                        path="*"
                        element={
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <Hash size={64} className="text-interactive-muted mb-4" />
                                <h3 className="text-lg font-semibold text-text-heading mb-2">
                                    No Channel Selected
                                </h3>
                                <p className="text-text-muted max-w-sm">
                                    Select a channel from the sidebar to start chatting.
                                </p>
                                {/* Mobile: show button to open sidebar */}
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="sm:hidden mt-4 px-4 py-2 bg-discord-primary text-white rounded-md font-medium"
                                >
                                    Browse Channels
                                </button>
                            </div>
                        }
                    />
                </Routes>
            </div>
        </div>
    );
}
