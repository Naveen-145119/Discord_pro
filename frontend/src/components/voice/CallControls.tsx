/**
 * CallControls Component
 * Control bar for voice/video calls
 */
import {
    Mic,
    MicOff,
    Headphones,
    HeadphoneOff,
    Video,
    VideoOff,
    MonitorUp,
    MonitorOff,
    PhoneOff
} from 'lucide-react';

interface CallControlsProps {
    isMuted: boolean;
    isDeafened: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onDisconnect: () => void;
}

export function CallControls({
    isMuted,
    isDeafened,
    isVideoOn,
    isScreenSharing,
    onToggleMute,
    onToggleDeafen,
    onToggleVideo,
    onToggleScreenShare,
    onDisconnect,
}: CallControlsProps) {
    return (
        <div className="flex items-center justify-center gap-2 p-4 bg-background-secondary border-t border-background-tertiary">
            {/* Mute */}
            <ControlButton
                onClick={onToggleMute}
                isActive={!isMuted}
                isWarning={isMuted}
                title={isMuted ? 'Unmute' : 'Mute'}
            >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </ControlButton>

            {/* Deafen */}
            <ControlButton
                onClick={onToggleDeafen}
                isActive={!isDeafened}
                isWarning={isDeafened}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
                {isDeafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
            </ControlButton>

            {/* Video */}
            <ControlButton
                onClick={onToggleVideo}
                isActive={isVideoOn}
                title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
            >
                {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </ControlButton>

            {/* Screen Share */}
            <ControlButton
                onClick={onToggleScreenShare}
                isActive={isScreenSharing}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
                {isScreenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
            </ControlButton>

            {/* Disconnect */}
            <ControlButton
                onClick={onDisconnect}
                isDanger
                title="Disconnect"
            >
                <PhoneOff size={20} />
            </ControlButton>
        </div>
    );
}

// Control button sub-component
function ControlButton({
    children,
    onClick,
    isActive = false,
    isWarning = false,
    isDanger = false,
    title,
}: {
    children: React.ReactNode;
    onClick: () => void;
    isActive?: boolean;
    isWarning?: boolean;
    isDanger?: boolean;
    title: string;
}) {
    const baseClasses = 'p-3 rounded-full transition-all duration-200';

    let colorClasses = 'bg-background-tertiary text-text-muted hover:bg-background-modifier-hover hover:text-text-normal';

    if (isDanger) {
        colorClasses = 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white';
    } else if (isWarning) {
        colorClasses = 'bg-red-500/20 text-red-400 hover:bg-red-500/30';
    } else if (isActive) {
        colorClasses = 'bg-discord-primary/20 text-discord-primary hover:bg-discord-primary/30';
    }

    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${colorClasses}`}
            title={title}
        >
            {children}
        </button>
    );
}
