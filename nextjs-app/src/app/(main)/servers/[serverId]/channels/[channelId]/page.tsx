'use client';

import { useParams } from 'next/navigation';

// Channel page - renders specific channel within a server
export default function ChannelPage() {
    const params = useParams();
    const serverId = params.serverId as string;
    const channelId = params.channelId as string;

    return (
        <>
            {/* Channel header */}
            <div className="h-12 border-b border-[#1E1F22] flex items-center px-4">
                <div className="flex items-center gap-2 text-[#949BA4]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657Z" />
                    </svg>
                    <span className="text-[#F2F3F5] font-semibold">Channel {channelId}</span>
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <p className="text-[#949BA4]">
                                This is channel {channelId} in server {serverId}
                            </p>
                            <p className="text-[#6D6F78] text-sm mt-2">
                                Messages will appear here
                            </p>
                        </div>
                    </div>
                </div>

                {/* Message input */}
                <div className="p-4">
                    <div className="bg-[#383A40] rounded-lg flex items-center px-4 py-2.5">
                        <button className="text-[#B5BAC1] hover:text-[#DBDEE1] mr-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 20C9.5 20 7.29 18.78 6 16.88C6.03 14.59 10 13.3 12 13.3C13.99 13.3 17.97 14.59 18 16.88C16.71 18.78 14.5 20 12 20Z" />
                            </svg>
                        </button>
                        <input
                            type="text"
                            placeholder={`Message #channel-${channelId}`}
                            className="flex-1 bg-transparent text-[#DBDEE1] placeholder-[#6D6F78] outline-none"
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
