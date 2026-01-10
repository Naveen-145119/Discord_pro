'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useServerStore } from '@/stores/server-store';
import { ServerSidebar } from '@/components/server-sidebar';
import { Users, MessageCircle, Activity } from 'lucide-react';

// Root page - shows home screen when authenticated, redirects to login when not
export default function RootPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkSession } = useAuthStore();
  const { servers, fetchServers } = useServerStore();
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'blocked'>('online');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (mounted && !isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.$id) {
        fetchServers(user.$id);
      }
    }
  }, [mounted, isLoading, isAuthenticated, router, user, fetchServers]);

  // Don't render until mounted (prevents hydration issues)
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1E1F22]">
        <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1E1F22]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#949BA4] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading if not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1E1F22]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#949BA4] text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // AUTHENTICATED - Render the main app home screen
  return (
    <div className="flex h-screen bg-[#313338] overflow-hidden">
      {/* Server Sidebar */}
      <ServerSidebar />

      {/* Friends/DM Sidebar */}
      <div className="w-60 bg-[#2B2D31] flex flex-col">
        {/* Search bar */}
        <div className="h-12 px-2 flex items-center border-b border-[#1E1F22] shadow-sm">
          <button className="w-full bg-[#1E1F22] text-[#949BA4] text-sm px-2 py-1.5 rounded text-left">
            Find or start a conversation
          </button>
        </div>

        {/* Navigation */}
        <div className="p-2">
          <button className="w-full flex items-center gap-3 px-2 py-2 rounded bg-[#404249] text-white">
            <Users size={20} />
            <span className="text-sm font-medium">Friends</span>
          </button>
        </div>

        {/* DM Section */}
        <div className="px-2 mt-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-[#949BA4] uppercase">
              Direct Messages
            </span>
            <button className="text-[#949BA4] hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11h-7V4h-2v7H4v2h7v7h2v-7h7v-2z" />
              </svg>
            </button>
          </div>
          <p className="text-[#949BA4] text-xs px-2">No direct messages yet</p>
        </div>

        {/* User Panel at bottom */}
        <div className="mt-auto h-[52px] bg-[#232428] px-2 flex items-center">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-medium">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#232428] bg-[#23A55A]" />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-[#F2F3F5] truncate">
              {user?.displayName || user?.username}
            </p>
            <p className="text-xs text-[#949BA4]">Online</p>
          </div>
        </div>
      </div>

      {/* Main Content - Friends List */}
      <div className="flex-1 flex flex-col bg-[#313338]">
        {/* Header */}
        <div className="h-12 flex items-center px-4 border-b border-[#1E1F22] shadow-sm">
          <Users size={20} className="text-[#949BA4] mr-2" />
          <span className="font-semibold text-[#F2F3F5]">Friends</span>

          {/* Tabs */}
          <div className="ml-6 flex gap-4">
            {(['online', 'all', 'pending', 'blocked'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2 py-1 text-sm rounded ${activeTab === tab
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949BA4] hover:text-[#DBDEE1]'
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <button className="ml-auto bg-[#248046] text-white text-sm px-4 py-1.5 rounded font-medium hover:bg-[#1A6334]">
            Add Friend
          </button>
        </div>

        {/* Friends Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-48 h-48 mx-auto mb-4 bg-[#383A40] rounded-full flex items-center justify-center">
              <Activity size={64} className="text-[#4E5058]" />
            </div>
            <p className="text-[#949BA4]">
              {activeTab === 'online' && 'No one is online right now.'}
              {activeTab === 'all' && 'You have no friends yet. Wumpus is here for you.'}
              {activeTab === 'pending' && 'There are no pending friend requests.'}
              {activeTab === 'blocked' && 'No blocked users.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
