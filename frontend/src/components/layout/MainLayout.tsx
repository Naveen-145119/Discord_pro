import { Outlet } from 'react-router-dom';
import { ServerSidebar } from './ServerSidebar';

/**
 * Main application layout with Discord-like structure:
 * - Server sidebar (left)
 * - Main content area (center/right)
 */
export function MainLayout() {
    return (
        <div className="flex h-screen bg-background-primary overflow-hidden">
            {/* Server sidebar - fixed width */}
            <ServerSidebar />

            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}
