import { Outlet } from 'react-router-dom';
import { ServerSidebar } from './ServerSidebar';

export function MainLayout() {
    return (
        <div className="flex h-screen bg-background-primary overflow-hidden">
            <ServerSidebar />

            <div className="flex-1 flex overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}
