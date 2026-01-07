import {
    Signal,
    MonitorUp,
    PhoneOff,
    Video,
    VideoOff,
    Rocket
} from 'lucide-react';
import { useCallContext } from '@/providers/CallProvider';
import { useSettingsStore } from '@/stores/settingsStore';


export function VoiceConnectionPanel() {
    const {
        connectionState,
        currentCall,
        endCall,
        isVideoOn,
        toggleVideo,
        toggleScreenShare,
        setIsMinimized
    } = useCallContext();

    const { openSettings, setActiveTab } = useSettingsStore();

    // Only show if connected or connecting
    if (connectionState === 'disconnected' || connectionState === 'closed' || connectionState === 'failed') return null;

    // Determine display name (Friend's name or Channel)
    const displayName = currentCall?.receiver?.displayName || currentCall?.caller?.displayName || 'Unknown';
    const channelName = currentCall?.callerId ? (currentCall.callerId === 'me' ? 'General' : displayName) : 'General'; // Placeholder logic

    const isActive = connectionState === 'connected';

    return (
        <div className="bg-[#232428] border-b border-[#1e1f22] flex flex-col font-sans">
            {/* Connection Status Area */}
            <div
                className="px-2 pt-2 pb-1 flex items-center justify-between group cursor-pointer"
                onClick={() => setIsMinimized(false)} // Click to maximize call
            >
                <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-1 mb-0.5 ${isActive ? 'text-discord-green' : 'text-yellow-500'}`}>
                        <Signal size={14} className="font-bold" />
                        <span className="font-bold text-xs uppercase tracking-wide select-none">
                            {isActive ? 'Voice Connected' : 'Connecting...'}
                        </span>
                    </div>
                    <div className="text-[#949BA4] text-xs truncate select-none flex items-center gap-1">
                        <span className="text-gray-400">{channelName}</span>
                        <span className="text-gray-500">/</span>
                        <span className="text-white font-medium">Server</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Noise Suppression (Visual Placeholder) */}
                    <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="p-1 rounded text-gray-400 hover:text-white"
                        title="Noise Suppression"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v18" />
                            <path d="M8 8v8" />
                            <path d="M16 8v8" />
                            <path d="M4 11v2" />
                            <path d="M20 11v2" />
                        </svg>
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            endCall();
                        }}
                        className="p-1 rounded text-gray-400 hover:text-white"
                        title="Disconnect"
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-3 px-1 pb-2 gap-1">
                {/* Video Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
                    className={`flex flex-col items-center justify-center py-1 rounded hover:bg-[#35373c] transition-colors py-2 ${isVideoOn ? 'text-white' : 'text-gray-300'}`}
                    title="Turn On Camera"
                >
                    {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>

                {/* Screen Share */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleScreenShare(); }}
                    className="flex flex-col items-center justify-center py-1 rounded hover:bg-[#35373c] transition-colors py-2 text-gray-300 hover:text-white"
                    title="Share Your Screen"
                >
                    <MonitorUp size={20} />
                </button>

                {/* Activities */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Placeholder for activities
                        setActiveTab('voice-video');
                        openSettings();
                    }}
                    className="flex flex-col items-center justify-center py-1 rounded hover:bg-[#35373c] transition-colors py-2 text-gray-300 hover:text-white"
                    title="Start an Activity"
                >
                    <Rocket size={20} />
                </button>
            </div>
        </div>
    );
}
