import { Mic, MicOff, Headphones, HeadphoneOff, Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCallContext } from '@/providers/CallProvider';
import { useState } from 'react';
import { ProfilePopover } from '@/components/modals/ProfilePopover';

export function UserArea() {
    const { user } = useAuthStore();
    const { openSettings } = useSettingsStore();

    // We use call context for mute/deafen state even if not in a call
    // Logic: Mute/Deafen are global states that persist
    // If we're not inside CallProvider, these might fail if context is missing.
    // However, CallProvider wraps the whole app, so it should be fine.

    // Safe access to context in case it's used where context isn't available (unlikely in this app structure)
    let callContext;
    try {
        callContext = useCallContext();
    } catch (e) {
        // Fallback or handle error if needed, but for now we expect it to exist
        callContext = null;
    }

    const isMuted = callContext?.isMuted || false;
    const isDeafened = callContext?.isDeafened || false;
    const toggleMute = callContext?.toggleMute || (() => { });
    const toggleDeafen = callContext?.toggleDeafen || (() => { });

    const [selectedProfile, setSelectedProfile] = useState<{
        user: typeof user;
        position: { x: number; y: number };
    } | null>(null);

    const handleProfileClick = (e: React.MouseEvent) => {
        if (!user) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedProfile({
            user,
            position: { x: e.clientX, y: e.clientY }
        });
    };

    if (!user) return null;

    return (
        <>
            <div className="bg-[#232428] p-2 flex-shrink-0 border-t border-[#1e1f22]">
                <div className="flex items-center gap-2 group">
                    <div
                        className="relative flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={handleProfileClick}
                    >
                        <div className="w-8 h-8 rounded-full bg-discord-primary flex items-center justify-center overflow-hidden">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs font-medium text-white">
                                    {user.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#232428]" />
                    </div>

                    <div className="flex-1 min-w-0 mr-1 select-none">
                        <div className="text-sm font-semibold text-white truncate leading-tight">
                            {user.displayName}
                        </div>
                        <div className="text-xs text-gray-400 truncate leading-tight">
                            #{user.username || '0000'}
                        </div>
                    </div>

                    <div className="flex items-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            className="p-1.5 rounded hover:bg-[#3f4147] text-gray-300 hover:text-white transition-colors relative"
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? (
                                <MicOff size={19} className="text-red-500" />
                            ) : (
                                <Mic size={19} />
                            )}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleDeafen(); }}
                            className="p-1.5 rounded hover:bg-[#3f4147] text-gray-300 hover:text-white transition-colors"
                            title={isDeafened ? "Undeafen" : "Deafen"}
                        >
                            {isDeafened ? (
                                <HeadphoneOff size={19} className="text-red-500" />
                            ) : (
                                <Headphones size={19} />
                            )}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); openSettings(); }}
                            className="p-1.5 rounded hover:bg-[#3f4147] text-gray-300 hover:text-white transition-colors"
                            title="User Settings"
                        >
                            <Settings size={19} />
                        </button>
                    </div>
                </div>
            </div>

            {selectedProfile && (
                <ProfilePopover
                    user={{
                        ...selectedProfile.user,
                        displayName: selectedProfile.user?.displayName || 'Unknown',
                        bio: selectedProfile.user?.bio || undefined,
                        avatarUrl: selectedProfile.user?.avatarUrl || undefined,
                        username: selectedProfile.user?.username || undefined,
                        status: selectedProfile.user?.status || 'offline'
                    }}
                    isOpen={!!selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                    isCurrentUser={true}
                    position={selectedProfile.position}
                    onMessage={() => setSelectedProfile(null)}
                />
            )}
        </>
    );
}
