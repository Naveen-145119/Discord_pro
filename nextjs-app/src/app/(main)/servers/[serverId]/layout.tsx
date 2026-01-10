'use client';

import { useParams } from 'next/navigation';

// Server layout (Blueprint Section 4.1)
// Responsibilities:
// - Fetches server data (can be done server-side in production)
// - Renders channel sidebar
// - Route guard: checks membership
export default function ServerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const serverId = params.serverId as string;

    return (
        <>
            {/* Channel Sidebar */}
            <div className="w-60 bg-[#2B2D31] flex flex-col">
                {/* Server header */}
                <div className="h-12 border-b border-[#1E1F22] flex items-center px-4 shadow-sm">
                    <h2 className="font-semibold text-[#F2F3F5] truncate">
                        Server {serverId}
                    </h2>
                </div>

                {/* Channel list */}
                <div className="flex-1 px-2 py-4 overflow-y-auto thin-scrollbar">
                    {/* Text channels category */}
                    <div className="mb-4">
                        <div className="flex items-center gap-1 px-1 mb-1 text-[#949BA4] hover:text-[#DBDEE1] cursor-pointer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                            </svg>
                            <span className="text-xs font-semibold uppercase">Text Channels</span>
                        </div>

                        <div className="channel-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#949BA4">
                                <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 15H15.41L16.47 9H10.47L9.41001 15Z" />
                            </svg>
                            <span className="text-sm">general</span>
                        </div>
                    </div>

                    {/* Voice channels category */}
                    <div>
                        <div className="flex items-center gap-1 px-1 mb-1 text-[#949BA4] hover:text-[#DBDEE1] cursor-pointer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                            </svg>
                            <span className="text-xs font-semibold uppercase">Voice Channels</span>
                        </div>

                        <div className="channel-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#949BA4">
                                <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.704C10.579 20.99 11.009 21.075 11.383 20.921C11.757 20.767 12 20.407 12 20V4.00004C12 3.59304 11.757 3.23304 11.383 3.07904Z" />
                                <path d="M14 10.7809V13.2189C14.54 12.9549 14.99 12.5489 15.31 12.0489C15.63 11.5519 15.78 10.9999 15.78 10.4399C15.78 9.87991 15.63 9.35991 15.31 8.86291C14.99 8.36291 14.54 7.92391 14 7.65991V10.0789V10.7809Z" />
                            </svg>
                            <span className="text-sm">General</span>
                        </div>
                    </div>
                </div>

                {/* User panel */}
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

            {/* Main content */}
            <div className="flex-1 flex flex-col bg-[#313338]">
                {children}
            </div>
        </>
    );
}
