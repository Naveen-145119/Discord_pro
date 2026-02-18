import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ServerSidebar } from './ServerSidebar';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { QuickSwitcher } from '@/components/QuickSwitcher';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePresence } from '@/hooks/usePresence';
import { useServerStore } from '@/stores/serverStore';
import { MessageCircle, Server, Users, Menu } from 'lucide-react';

export function MainLayout() {
    const isSettingsOpen = useSettingsStore((state) => state.isOpen);
    const navigate = useNavigate();
    const location = useLocation();
    const { servers } = useServerStore();

    // Mobile: track which server is selected for the bottom nav server list
    const [showMobileServerList, setShowMobileServerList] = useState(false);

    // Auto-presence: 15 min inactive → offline, 1 hour → logout
    usePresence();

    const isHome = location.pathname === '/' || location.pathname.startsWith('/dm');
    const isServer = location.pathname.startsWith('/servers');

    const handleMobileServerNav = () => {
        setShowMobileServerList((prev) => !prev);
    };

    return (
        <>
            {/* Main App Container - Scales down when settings is open */}
            <motion.div
                animate={{
                    scale: isSettingsOpen ? 0.95 : 1,
                    opacity: isSettingsOpen ? 0.5 : 1,
                }}
                transition={{ duration: 0.2 }}
                className="flex h-screen bg-background-primary overflow-hidden origin-center"
            >
                {/* Server sidebar — hidden on mobile, shown on sm+ */}
                <div className="hidden sm:flex">
                    <ServerSidebar />
                </div>

                <div className="flex-1 flex overflow-hidden pb-14 sm:pb-0">
                    <Outlet />
                </div>
            </motion.div>

            {/* ── Mobile Bottom Navigation Bar ─────────────────────── */}
            <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 h-14 bg-background-tertiary border-t border-background-modifier-active flex items-center justify-around px-2">
                {/* Home / DMs */}
                <button
                    onClick={() => { navigate('/'); setShowMobileServerList(false); }}
                    className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${isHome ? 'text-white' : 'text-interactive-muted hover:text-interactive-normal'
                        }`}
                >
                    <MessageCircle size={22} />
                    <span className="text-[10px] font-medium">Messages</span>
                </button>

                {/* Servers */}
                <button
                    onClick={handleMobileServerNav}
                    className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${isServer || showMobileServerList ? 'text-white' : 'text-interactive-muted hover:text-interactive-normal'
                        }`}
                >
                    <Server size={22} />
                    <span className="text-[10px] font-medium">Servers</span>
                </button>

                {/* Friends */}
                <button
                    onClick={() => { navigate('/'); setShowMobileServerList(false); }}
                    className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors text-interactive-muted hover:text-interactive-normal"
                >
                    <Users size={22} />
                    <span className="text-[10px] font-medium">Friends</span>
                </button>

                {/* Settings */}
                <button
                    onClick={() => useSettingsStore.getState().openSettings()}
                    className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors text-interactive-muted hover:text-interactive-normal"
                >
                    <Menu size={22} />
                    <span className="text-[10px] font-medium">More</span>
                </button>
            </nav>

            {/* ── Mobile Server List Drawer (from bottom nav "Servers") ── */}
            {showMobileServerList && (
                <div className="sm:hidden fixed inset-0 z-40" onClick={() => setShowMobileServerList(false)}>
                    <div className="absolute inset-0 bg-black/60" />
                    <div
                        className="absolute bottom-14 left-0 right-0 bg-background-tertiary rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xs font-semibold text-text-muted uppercase mb-3 px-1">Your Servers</h3>
                        <div className="grid grid-cols-4 gap-3">
                            {servers.map((server) => (
                                <button
                                    key={server.$id}
                                    onClick={() => {
                                        navigate(`/servers/${server.$id}`);
                                        setShowMobileServerList(false);
                                    }}
                                    className="flex flex-col items-center gap-1.5"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-discord-primary flex items-center justify-center overflow-hidden">
                                        {server.iconUrl ? (
                                            <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-white font-semibold text-lg">
                                                {server.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-text-muted text-center truncate w-full">{server.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal Overlay */}
            <SettingsModal />

            {/* Media Lightbox for image/video preview */}
            <MediaLightbox />

            {/* Quick Switcher (Ctrl/Cmd + K) */}
            <QuickSwitcher />
        </>
    );
}
