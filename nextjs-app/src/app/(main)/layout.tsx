'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { ServerSidebar } from '@/components/server-sidebar';

// Loading screen component
function LoadingScreen() {
    return (
        <div className="flex h-screen items-center justify-center bg-[#1E1F22]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                <p className="text-[#949BA4] text-sm">Loading Discord...</p>
            </div>
        </div>
    );
}

// Main layout for protected routes (Blueprint Section 4.1)
export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isAuthenticated, isLoading, checkSession } = useAuthStore();

    // Check session on mount
    useEffect(() => {
        checkSession();
    }, [checkSession]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isLoading, isAuthenticated, router]);

    // Show loading while checking session
    if (isLoading) {
        return <LoadingScreen />;
    }

    // Don't render anything if not authenticated (will redirect)
    if (!isAuthenticated) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex h-screen bg-[#313338] overflow-hidden">
            {/* Server Sidebar - Left icon strip (Blueprint Section 6.1) */}
            <ServerSidebar />

            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
                {children}
            </div>
        </div>
    );
}
