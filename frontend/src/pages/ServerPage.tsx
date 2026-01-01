import { useEffect } from 'react';
import { useParams, useNavigate, Routes, Route } from 'react-router-dom';
import { useServerStore } from '@/stores/serverStore';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChannelPage } from './ChannelPage';
import { Hash } from 'lucide-react';

/**
 * Server page - shows server channels and content
 */
export function ServerPage() {
    const { serverId } = useParams<{ serverId: string }>();
    const navigate = useNavigate();
    const { currentServer, channels, fetchServerDetails, isLoading } = useServerStore();

    // Fetch server details on mount or server change
    useEffect(() => {
        if (serverId) {
            fetchServerDetails(serverId);
        }
    }, [serverId, fetchServerDetails]);

    // Redirect to default channel if no channel selected
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
        <div className="flex flex-1 bg-background-primary">
            {/* Channel sidebar */}
            <ChannelSidebar server={currentServer} channels={channels} />

            {/* Channel content */}
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
                        </div>
                    }
                />
            </Routes>
        </div>
    );
}
