import {
    Mic,
    MicOff,
    Headphones,
    HeadphoneOff,
    Settings,
    Signal,
    MonitorUp,
    PhoneOff,
    Video,
    VideoOff
} from 'lucide-react';
import { useCallContext } from '@/providers/CallProvider';
import { useSettingsStore } from '@/stores/settingsStore';


export function VoiceConnectionPanel() {
    const {
        connectionState,
        currentCall,
        toggleMute,
        toggleDeafen,
        endCall,
        isMuted,
        isDeafened,
        isVideoOn,
        toggleVideo,
        toggleScreenShare,
        setIsMinimized
    } = useCallContext();

    const { openSettings, setActiveTab } = useSettingsStore();

    // Only show if connected or connecting
    if (connectionState === 'disconnected' || connectionState === 'closed' || connectionState === 'failed') return null;

    // Determine display name (Friend's name)
    const displayName = currentCall?.receiver?.displayName || currentCall?.caller?.displayName || 'Unknown';

    const isActive = connectionState === 'connected';

    return (
        <div className="bg-[#232428] border-b border-[#1e1f22] flex flex-col">
            {/* Connection Status Area */}
            <div
                className="px-2 py-1.5 flex items-center justify-between group cursor-pointer hover:bg-[#3f4147] transition-colors"
                onClick={() => setIsMinimized(false)} // Click to maximize call
            >
                <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-1.5 ${isActive ? 'text-discord-green' : 'text-yellow-500'}`}>
                        <Signal size={16} />
                        <span className="font-bold text-xs uppercase tracking-wide">
                            {isActive ? 'Voice Connected' : 'Connecting...'}
                        </span>
                    </div>
                    <div className="text-text-muted text-xs truncate">
                        {displayName} / <span className="text-text-normal">Direct Message</span>
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        endCall();
                    }}
                    className="p-1 rounded-sm text-text-normal hover:text-white"
                >
                    <PhoneOff size={16} />
                </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 px-1 pb-1">
                {/* Video Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
                    className={`flex justify-center items-center py-1.5 rounded hover:bg-[#3f4147] ${isVideoOn ? 'text-white' : 'text-text-normal'}`}
                    title="Turn On Camera"
                >
                    {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>

                {/* Screen Share */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleScreenShare(); }}
                    className="flex justify-center items-center py-1.5 rounded hover:bg-[#3f4147] text-text-normal hover:text-white"
                    title="Share Your Screen"
                >
                    <MonitorUp size={18} />
                </button>

                {/* Noise Suppression / Activity - Placeholder for visualizer or special feature */}
                <button
                    className="flex justify-center items-center py-1.5 rounded hover:bg-[#3f4147] text-text-normal hover:text-white"
                    title="Noise Suppression (Krisp)"
                    onClick={(e) => {
                        e.stopPropagation();
                        // Open voice settings specifically
                        setActiveTab('voice-video');
                        openSettings();
                    }}
                >
                    {/* Using a custom icon or generic wave for noise suppression */}
                    <div className="relative">
                        <Signal size={18} className="text-text-normal" />
                        <div className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-white text-black px-0.5 rounded">AI</div>
                    </div>
                </button>

                {/* Settings */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Open voice settings
                        setActiveTab('voice-video');
                        openSettings();
                    }}
                    className="flex justify-center items-center py-1.5 rounded hover:bg-[#3f4147] text-text-normal hover:text-white"
                    title="Voice Settings"
                >
                    <Settings size={18} />
                </button>
            </div>

            {/* Quick Actions Bar (Mute/Deafen) */}
            <div className="grid grid-cols-2 border-t border-white/5 py-1">
                <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className={`flex items-center justify-center gap-2 py-1 hover:bg-[#3f4147] rounded mx-1 ${isMuted ? 'text-discord-red' : 'text-text-normal'}`}
                >
                    {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); toggleDeafen(); }}
                    className={`flex items-center justify-center gap-2 py-1 hover:bg-[#3f4147] rounded mx-1 ${isDeafened ? 'text-discord-red' : 'text-text-normal'}`}
                >
                    {isDeafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
                </button>
            </div>
        </div>
    );
}
