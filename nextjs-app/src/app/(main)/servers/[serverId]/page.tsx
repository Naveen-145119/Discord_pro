'use client';

import { useParams } from 'next/navigation';

// Server page - default view when entering a server
// Shows the general/default channel
export default function ServerPage() {
    const params = useParams();
    const serverId = params.serverId as string;

    return (
        <>
            {/* Channel header */}
            <div className="h-12 border-b border-[#1E1F22] flex items-center px-4">
                <div className="flex items-center gap-2 text-[#949BA4]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657Z" />
                    </svg>
                    <span className="text-[#F2F3F5] font-semibold">general</span>
                </div>
            </div>

            {/* Chat area placeholder */}
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#5865F2] flex items-center justify-center">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                            <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657Z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-[#F2F3F5] mb-2">Welcome to #general!</h2>
                    <p className="text-[#949BA4]">
                        This is the start of the #general channel in Server {serverId}.
                    </p>
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
                        placeholder="Message #general"
                        className="flex-1 bg-transparent text-[#DBDEE1] placeholder-[#6D6F78] outline-none"
                    />
                    <div className="flex items-center gap-4 ml-4 text-[#B5BAC1]">
                        <button className="hover:text-[#DBDEE1]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 12C2 15.86 5.14 19 9 19L11 19V21L14 18L11 15V17L9 17C6.24 17 4 14.76 4 12C4 10.12 5.05 8.46 6.64 7.59L5.22 6.17C3.25 7.48 2 9.59 2 12ZM22 12C22 8.14 18.86 5 15 5L13 5V3L10 6L13 9V7L15 7C17.76 7 20 9.24 20 12C20 13.88 18.95 15.54 17.36 16.41L18.78 17.83C20.75 16.52 22 14.41 22 12Z" />
                            </svg>
                        </button>
                        <button className="hover:text-[#DBDEE1]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2ZM15.5 14C15.5 14.28 15.28 14.5 15 14.5H9C8.72 14.5 8.5 14.28 8.5 14C8.5 12.07 10.07 10.5 12 10.5C13.93 10.5 15.5 12.07 15.5 14ZM8.5 9C8.5 8.17 9.17 7.5 10 7.5C10.83 7.5 11.5 8.17 11.5 9C11.5 9.83 10.83 10.5 10 10.5C9.17 10.5 8.5 9.83 8.5 9ZM14 10.5C13.17 10.5 12.5 9.83 12.5 9C12.5 8.17 13.17 7.5 14 7.5C14.83 7.5 15.5 8.17 15.5 9C15.5 9.83 14.83 10.5 14 10.5Z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
