import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ServerSidebar } from './ServerSidebar';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { QuickSwitcher } from '@/components/QuickSwitcher';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePresence } from '@/hooks/usePresence';

export function MainLayout() {
    const isSettingsOpen = useSettingsStore((state) => state.isOpen);

    // Auto-presence: 15 min inactive → offline, 1 hour → logout
    usePresence();

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
                <ServerSidebar />

                <div className="flex-1 flex overflow-hidden">
                    <Outlet />
                </div>
            </motion.div>

            {/* Settings Modal Overlay */}
            <SettingsModal />

            {/* Media Lightbox for image/video preview */}
            <MediaLightbox />

            {/* Quick Switcher (Ctrl/Cmd + K) */}
            <QuickSwitcher />
        </>
    );
}

