'use client';

// Home page - Friends list / DMs (Blueprint Section 4.1)
// This renders when user navigates to / in the main layout
export default function HomePage() {
    return (
        <>
            {/* Friends/DM Sidebar */}
            <div className="w-60 bg-[#2B2D31] flex flex-col">
                {/* Search bar */}
                <div className="p-2">
                    <button className="w-full h-7 bg-[#1E1F22] text-[#949BA4] text-sm text-left px-2 rounded">
                        Find or start a conversation
                    </button>
                </div>

                {/* Direct Messages header */}
                <div className="px-2 pt-4">
                    <div className="flex items-center justify-between px-2 mb-1">
                        <span className="text-xs font-semibold text-[#949BA4] uppercase">
                            Direct Messages
                        </span>
                        <button className="text-[#949BA4] hover:text-[#DBDEE1]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14m-7-7h14" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* DM list would go here */}
                <div className="flex-1 overflow-y-auto px-2">
                    <p className="text-[#949BA4] text-sm text-center py-8">
                        No direct messages yet
                    </p>
                </div>

                {/* User panel at bottom */}
                <div className="h-[52px] bg-[#232428] px-2 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-sm font-medium">
                        U
                    </div>
                    <div className="ml-2 flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F2F3F5] truncate">User</p>
                        <p className="text-xs text-[#949BA4] truncate">Online</p>
                    </div>
                </div>
            </div>

            {/* Main content - Friends tab */}
            <div className="flex-1 flex flex-col bg-[#313338]">
                {/* Header */}
                <div className="h-12 border-b border-[#1E1F22] flex items-center px-4 gap-4">
                    <div className="flex items-center gap-2 text-[#DBDEE1]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                            <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.25.56 1.25 1.25V5h1.5v-.75C7 3.56 7.56 3 8.25 3s1.25.56 1.25 1.25V5c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2Z" />
                            <path d="M19.5 14a1.5 1.5 0 0 0-1.5 1.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0-1.5-1.5Z" />
                            <path d="M13 12.5C7.75 12.5 3.5 14.47 3.5 17v2.5h19V17c0-2.53-4.25-4.5-9.5-4.5Z" />
                        </svg>
                        <span className="font-semibold">Friends</span>
                    </div>

                    <div className="h-6 w-[1px] bg-[#35363C]" />

                    {/* Tab buttons */}
                    <div className="flex gap-4">
                        <button className="text-[#949BA4] hover:text-[#DBDEE1] text-sm">
                            Online
                        </button>
                        <button className="text-[#949BA4] hover:text-[#DBDEE1] text-sm">
                            All
                        </button>
                        <button className="text-[#949BA4] hover:text-[#DBDEE1] text-sm">
                            Pending
                        </button>
                        <button className="text-[#949BA4] hover:text-[#DBDEE1] text-sm">
                            Blocked
                        </button>
                        <button className="bg-[#248046] text-white text-sm px-2 py-0.5 rounded">
                            Add Friend
                        </button>
                    </div>
                </div>

                {/* Friends content */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-48 h-48 mx-auto mb-4 bg-[#2B2D31] rounded-lg flex items-center justify-center">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="#949BA4">
                                <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                                <path d="M13 12.5C7.75 12.5 3.5 14.47 3.5 17v2.5h19V17c0-2.53-4.25-4.5-9.5-4.5Z" />
                            </svg>
                        </div>
                        <p className="text-[#949BA4]">
                            No one&apos;s around to play with Wumpus.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
