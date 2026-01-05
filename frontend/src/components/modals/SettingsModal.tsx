import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    User as UserIcon,
    Palette,
    Mic,
    Bell,
    Volume2,
    Video,
    Sliders,
    LogOut,
    ChevronRight
} from 'lucide-react';
import { useSettingsStore, type SettingsTab } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { useMediaStore } from '@/stores/mediaStore';
import type { User } from '@/types';

// Settings category definition
interface SettingsCategory {
    id: SettingsTab;
    label: string;
    icon: React.ReactNode;
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
    { id: 'my-account', label: 'My Account', icon: <UserIcon size={20} /> },
    { id: 'profiles', label: 'Profiles', icon: <UserIcon size={20} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={20} /> },
    { id: 'voice-video', label: 'Voice & Video', icon: <Mic size={20} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={20} /> },
];

/**
 * SettingsModal - Discord-style full-screen settings overlay
 * Features:
 * - Left sidebar with categories
 * - Right content panel
 * - ESC key to close
 * - Smooth animations
 */
export function SettingsModal() {
    const { isOpen, activeTab, closeSettings, setActiveTab, soundsEnabled, setSoundsEnabled } = useSettingsStore();
    const { user, logout } = useAuthStore();

    // ESC key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeSettings();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeSettings]);

    const handleLogout = async () => {
        closeSettings();
        await logout();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[200] flex"
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-[#313338]" />

                    {/* Settings Container */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                        className="relative flex w-full h-full"
                    >
                        {/* Left Sidebar */}
                        <div className="w-[218px] min-w-[218px] bg-[#2b2d31] flex flex-col">
                            {/* Sidebar Header */}
                            <div className="flex-1 overflow-y-auto py-[60px] px-2">
                                {/* User Settings Label */}
                                <div className="px-2.5 py-1.5 text-xs font-bold text-text-muted uppercase tracking-wide mb-1">
                                    User Settings
                                </div>

                                {/* Category List */}
                                <nav className="space-y-0.5">
                                    {SETTINGS_CATEGORIES.map((category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => setActiveTab(category.id)}
                                            className={`w - full flex items - center gap - 3 px - 2.5 py - 1.5 rounded text - left transition - colors ${activeTab === category.id
                                                ? 'bg-background-modifier-selected text-white'
                                                : 'text-text-muted hover:bg-background-modifier-hover hover:text-text-normal'
                                                } `}
                                        >
                                            {category.icon}
                                            <span className="text-sm font-medium">{category.label}</span>
                                        </button>
                                    ))}
                                </nav>

                                {/* Separator */}
                                <div className="h-px bg-background-modifier-accent my-2 mx-2.5" />

                                {/* Log Out Button */}
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-text-muted hover:bg-background-modifier-hover hover:text-text-normal transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <LogOut size={20} />
                                        <span className="text-sm font-medium">Log Out</span>
                                    </div>
                                    <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </div>
                        </div>

                        {/* Right Content Area */}
                        <div className="flex-1 bg-[#313338] flex">
                            {/* Content Panel */}
                            <div className="flex-1 max-w-[740px] py-[60px] px-10 overflow-y-auto">
                                <SettingsContent
                                    activeTab={activeTab}
                                    user={user}
                                    soundsEnabled={soundsEnabled}
                                    onSoundsToggle={setSoundsEnabled}
                                />
                            </div>

                            {/* Close Button Area */}
                            <div className="w-[60px] py-[60px] flex flex-col items-center">
                                <button
                                    onClick={closeSettings}
                                    className="w-9 h-9 rounded-full border-2 border-text-muted flex items-center justify-center text-text-muted hover:border-white hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                                <span className="text-xs text-text-muted mt-2 font-medium">ESC</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Settings Content - Renders the active tab's content
 */
function SettingsContent({
    activeTab,
    user,
    soundsEnabled,
    onSoundsToggle,
}: {
    activeTab: SettingsTab;
    user: User | null;
    soundsEnabled: boolean;
    onSoundsToggle: (enabled: boolean) => void;
}) {
    switch (activeTab) {
        case 'my-account':
            return <MyAccountPanel user={user} />;
        case 'profiles':
            return <ProfilesPanel user={user} />;
        case 'appearance':
            return <AppearancePanel />;
        case 'voice-video':
            return <VoiceVideoPanel />;
        case 'notifications':
            return <NotificationsPanel soundsEnabled={soundsEnabled} onSoundsToggle={onSoundsToggle} />;
        default:
            return null;
    }
}

/**
 * My Account Panel
 */
function MyAccountPanel({ user }: { user: User | null }) {
    return (
        <div>
            <h2 className="text-xl font-bold text-text-heading mb-5">My Account</h2>

            {/* User Card Preview */}
            <div className="bg-[#232428] rounded-lg overflow-hidden">
                {/* Banner */}
                <div
                    className="h-[100px] bg-gradient-to-r from-discord-primary to-purple-600"
                    style={user?.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})`, backgroundSize: 'cover' } : undefined}
                />

                {/* Profile Section */}
                <div className="px-4 pb-4">
                    {/* Avatar */}
                    <div className="relative -mt-[50px] mb-3">
                        <div className="w-[80px] h-[80px] rounded-full border-[6px] border-[#232428] bg-[#232428] overflow-hidden">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-discord-primary flex items-center justify-center">
                                    <span className="text-2xl font-bold text-white">
                                        {user?.displayName?.charAt(0) || '?'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* User Info Card */}
                    <div className="bg-[#111214] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-lg font-bold text-white">{user?.displayName}</p>
                                <p className="text-sm text-text-muted">@{user?.username}</p>
                            </div>
                            <button className="px-4 py-1.5 bg-discord-primary hover:bg-discord-primary-dark text-white text-sm font-medium rounded transition-colors">
                                Edit User Profile
                            </button>
                        </div>

                        {/* Info Fields */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-t border-white/10">
                                <div>
                                    <p className="text-xs text-text-muted uppercase font-bold">Display Name</p>
                                    <p className="text-sm text-text-normal">{user?.displayName}</p>
                                </div>
                                <button className="px-3 py-1 bg-background-secondary hover:bg-background-modifier-hover text-sm text-text-normal rounded transition-colors">
                                    Edit
                                </button>
                            </div>

                            <div className="flex items-center justify-between py-2 border-t border-white/10">
                                <div>
                                    <p className="text-xs text-text-muted uppercase font-bold">Username</p>
                                    <p className="text-sm text-text-normal">@{user?.username}</p>
                                </div>
                                <button className="px-3 py-1 bg-background-secondary hover:bg-background-modifier-hover text-sm text-text-normal rounded transition-colors">
                                    Edit
                                </button>
                            </div>

                            <div className="flex items-center justify-between py-2 border-t border-white/10">
                                <div>
                                    <p className="text-xs text-text-muted uppercase font-bold">Email</p>
                                    <p className="text-sm text-text-normal">{user?.email}</p>
                                </div>
                                <button className="px-3 py-1 bg-background-secondary hover:bg-background-modifier-hover text-sm text-text-normal rounded transition-colors">
                                    Edit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Profiles Panel - Avatar/Banner/Bio editing with live preview
 */
function ProfilesPanel({ user }: { user: User | null }) {
    const { updateProfile, isUpdatingProfile } = useAuthStore();
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bio, setBio] = useState(user?.bio || '');
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [hasChanges, setHasChanges] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
            setHasChanges(true);
        }
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBannerFile(file);
            setBannerPreview(URL.createObjectURL(file));
            setHasChanges(true);
        }
    };

    const handleSave = async () => {
        try {
            await updateProfile({
                avatar: avatarFile || undefined,
                banner: bannerFile || undefined,
                bio: bio !== user?.bio ? bio : undefined,
                displayName: displayName !== user?.displayName ? displayName : undefined,
            });
            setAvatarFile(null);
            setBannerFile(null);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
        }
    };

    // Determine what to display for avatar/banner (preview or current)
    const displayAvatar = avatarPreview || user?.avatarUrl;
    const displayBanner = bannerPreview || user?.bannerUrl;

    return (
        <div>
            <h2 className="text-xl font-bold text-text-heading mb-5">Profiles</h2>

            {/* Live Preview Card */}
            <div className="bg-[#232428] rounded-lg overflow-hidden mb-6">
                <div
                    className="h-[100px] bg-gradient-to-r from-discord-primary to-purple-600"
                    style={displayBanner ? { backgroundImage: `url(${displayBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                />
                <div className="px-4 pb-4">
                    <div className="relative -mt-[50px] mb-3">
                        <div className="w-[80px] h-[80px] rounded-full border-[6px] border-[#232428] bg-[#232428] overflow-hidden">
                            {displayAvatar ? (
                                <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-discord-primary flex items-center justify-center">
                                    <span className="text-2xl font-bold text-white">
                                        {displayName?.charAt(0) || '?'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-lg font-bold text-white">{displayName || user?.displayName}</p>
                    <p className="text-sm text-text-muted">@{user?.username}</p>
                    {bio && <p className="text-sm text-text-normal mt-2">{bio}</p>}
                </div>
            </div>

            <div className="space-y-6">
                {/* Avatar Section */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                    />
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-text-heading mb-1">Avatar</h3>
                            <p className="text-sm text-text-muted">
                                Upload a custom avatar for your profile.
                            </p>
                        </div>
                        <div className="w-[72px] h-[72px] rounded-full bg-[#111214] overflow-hidden">
                            {displayAvatar ? (
                                <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-discord-primary flex items-center justify-center">
                                    <span className="text-xl font-bold text-white">
                                        {user?.displayName?.charAt(0) || '?'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="mt-4 px-4 py-2 bg-discord-primary hover:bg-discord-primary-dark text-white text-sm font-medium rounded transition-colors"
                    >
                        Change Avatar
                    </button>
                </div>

                {/* Banner Section */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBannerChange}
                        className="hidden"
                    />
                    <h3 className="font-semibold text-text-heading mb-1">Profile Banner</h3>
                    <p className="text-sm text-text-muted mb-4">
                        Upload a custom banner for your profile.
                    </p>
                    <div
                        className="h-[120px] rounded-lg bg-gradient-to-r from-discord-primary to-purple-600 overflow-hidden"
                        style={displayBanner ? { backgroundImage: `url(${displayBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    />
                    <button
                        onClick={() => bannerInputRef.current?.click()}
                        className="mt-4 px-4 py-2 bg-discord-primary hover:bg-discord-primary-dark text-white text-sm font-medium rounded transition-colors"
                    >
                        Change Banner
                    </button>
                </div>

                {/* Display Name Section */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <h3 className="font-semibold text-text-heading mb-1">Display Name</h3>
                    <p className="text-sm text-text-muted mb-4">
                        This is how others will see you.
                    </p>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => { setDisplayName(e.target.value); setHasChanges(true); }}
                        maxLength={32}
                        className="w-full p-3 bg-[#1e1f22] text-text-normal rounded focus:outline-none focus:ring-2 focus:ring-discord-primary"
                    />
                </div>

                {/* About Me Section */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <h3 className="font-semibold text-text-heading mb-1">About Me</h3>
                    <p className="text-sm text-text-muted mb-4">
                        Write a short bio to tell people about yourself. Max 190 characters.
                    </p>
                    <textarea
                        value={bio}
                        onChange={(e) => { setBio(e.target.value); setHasChanges(true); }}
                        maxLength={190}
                        placeholder="Tell us about yourself..."
                        className="w-full h-24 p-3 bg-[#1e1f22] text-text-normal rounded resize-none focus:outline-none focus:ring-2 focus:ring-discord-primary placeholder:text-text-muted"
                    />
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-text-muted">
                            {bio.length}/190
                        </span>
                    </div>
                </div>

                {/* Save Button */}
                {hasChanges && (
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isUpdatingProfile}
                            className="px-6 py-2.5 bg-discord-green hover:bg-discord-green/90 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                        >
                            {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Appearance Panel - Theme settings
 */
function AppearancePanel() {
    const { theme, setTheme } = useThemeStore();

    const themes: { id: Theme; label: string; preview: string }[] = [
        { id: 'dark', label: 'Dark', preview: '#313338' },
        { id: 'light', label: 'Light', preview: '#ffffff' },
        { id: 'midnight', label: 'Midnight', preview: '#000000' },
    ];

    return (
        <div>
            <h2 className="text-xl font-bold text-text-heading mb-5">Appearance</h2>

            {/* Theme Selection */}
            <div className="bg-[#232428] rounded-lg p-4">
                <h3 className="font-semibold text-text-heading mb-4">Theme</h3>

                <div className="grid grid-cols-3 gap-4">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className={`p - 3 bg - [#1e1f22] rounded - lg border - 2 text - center transition - colors ${theme === t.id
                                ? 'border-discord-primary'
                                : 'border-transparent hover:bg-[#2a2b2f] hover:border-white/20'
                                } `}
                        >
                            <div
                                className="w-full h-16 rounded mb-2"
                                style={{ backgroundColor: t.preview }}
                            />
                            <span className={`text - sm font - medium ${theme === t.id ? 'text-white' : 'text-text-muted'
                                } `}>
                                {t.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Voice & Video Panel
 */
function VoiceVideoPanel() {
    const {
        inputDeviceId, setInputDeviceId,
        outputDeviceId, setOutputDeviceId,
        videoDeviceId, setVideoDeviceId,
        echoCancellation, setEchoCancellation,
        noiseSuppression, setNoiseSuppression,
        autoGainControl, setAutoGainControl,
        inputVolume, setInputVolume,
        outputVolume, setOutputVolume
    } = useMediaStore();

    const [devices, setDevices] = useState<{
        audioinput: MediaDeviceInfo[];
        audiooutput: MediaDeviceInfo[];
        videoinput: MediaDeviceInfo[];
    }>({ audioinput: [], audiooutput: [], videoinput: [] });

    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request permission first to get device labels
                // Note: user might have already granted it
                const devs = await navigator.mediaDevices.enumerateDevices();
                setDevices({
                    audioinput: devs.filter(d => d.kind === 'audioinput'),
                    audiooutput: devs.filter(d => d.kind === 'audiooutput'),
                    videoinput: devs.filter(d => d.kind === 'videoinput')
                });
            } catch (err) {
                console.error("Failed to enumerate devices", err);
            }
        };
        getDevices();

        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    return (
        <div>
            <h2 className="text-xl font-bold text-text-heading mb-5">Voice & Video</h2>

            <div className="space-y-6">
                {/* Voice Settings */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Input Device */}
                    <div className="bg-[#232428] rounded-lg p-4">
                        <h3 className="font-semibold text-text-heading mb-3 flex items-center gap-2">
                            <Mic size={16} /> Input Device
                        </h3>
                        <select
                            value={inputDeviceId}
                            onChange={(e) => setInputDeviceId(e.target.value)}
                            className="w-full p-2.5 bg-[#1e1f22] text-text-normal rounded focus:outline-none focus:ring-2 focus:ring-discord-primary"
                        >
                            <option value="default">Default</option>
                            {devices.audioinput.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}...`}</option>
                            ))}
                        </select>

                        <div className="mt-4">
                            <div className="flex justify-between text-xs font-semibold text-text-muted mb-1 uppercase">
                                <span>Input Volume</span>
                                <span>{inputVolume}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="200"
                                value={inputVolume}
                                onChange={(e) => setInputVolume(parseInt(e.target.value))}
                                className="w-full accent-discord-primary"
                            />
                        </div>
                    </div>

                    {/* Output Device */}
                    <div className="bg-[#232428] rounded-lg p-4">
                        <h3 className="font-semibold text-text-heading mb-3 flex items-center gap-2">
                            <Volume2 size={16} /> Output Device
                        </h3>
                        <select
                            value={outputDeviceId}
                            onChange={(e) => setOutputDeviceId(e.target.value)}
                            className="w-full p-2.5 bg-[#1e1f22] text-text-normal rounded focus:outline-none focus:ring-2 focus:ring-discord-primary"
                        >
                            <option value="default">Default</option>
                            {devices.audiooutput.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 5)}...`}</option>
                            ))}
                        </select>

                        <div className="mt-4">
                            <div className="flex justify-between text-xs font-semibold text-text-muted mb-1 uppercase">
                                <span>Output Volume</span>
                                <span>{outputVolume}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="200"
                                value={outputVolume}
                                onChange={(e) => setOutputVolume(parseInt(e.target.value))}
                                className="w-full accent-discord-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Video Settings */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <h3 className="font-semibold text-text-heading mb-3 flex items-center gap-2">
                        <Video size={16} /> Camera
                    </h3>
                    <select
                        value={videoDeviceId}
                        onChange={(e) => setVideoDeviceId(e.target.value)}
                        className="w-full p-2.5 bg-[#1e1f22] text-text-normal rounded focus:outline-none focus:ring-2 focus:ring-discord-primary"
                    >
                        <option value="default">Default</option>
                        {devices.videoinput.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}...`}</option>
                        ))}
                    </select>
                </div>

                {/* Advanced Processing */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <h3 className="font-semibold text-text-heading mb-4 flex items-center gap-2">
                        <Sliders size={16} /> Advanced Voice Processing
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-text-normal">Echo Cancellation</h4>
                                <p className="text-xs text-text-muted">Prevents echo when using speakers</p>
                            </div>
                            <button
                                onClick={() => setEchoCancellation(!echoCancellation)}
                                className={`w - 10 h - 6 rounded - full relative transition - colors ${echoCancellation ? 'bg-discord-green' : 'bg-gray-500'} `}
                            >
                                <div className={`absolute top - 1 left - 1 w - 4 h - 4 rounded - full bg - white transition - transform ${echoCancellation ? 'translate-x-4' : 'translate-x-0'} `} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-text-normal flex items-center gap-2">
                                    Noise Suppression
                                    <span className="bg-discord-brand text-white text-[10px] px-1 rounded uppercase font-bold">Krisp</span>
                                </h4>
                                <p className="text-xs text-text-muted">Suppresses background noise (fans, typing)</p>
                            </div>
                            <button
                                onClick={() => setNoiseSuppression(!noiseSuppression)}
                                className={`w - 10 h - 6 rounded - full relative transition - colors ${noiseSuppression ? 'bg-discord-green' : 'bg-gray-500'} `}
                            >
                                <div className={`absolute top - 1 left - 1 w - 4 h - 4 rounded - full bg - white transition - transform ${noiseSuppression ? 'translate-x-4' : 'translate-x-0'} `} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-text-normal">Automatic Gain Control</h4>
                                <p className="text-xs text-text-muted">Automatically adjusts your microphone volume</p>
                            </div>
                            <button
                                onClick={() => setAutoGainControl(!autoGainControl)}
                                className={`w - 10 h - 6 rounded - full relative transition - colors ${autoGainControl ? 'bg-discord-green' : 'bg-gray-500'} `}
                            >
                                <div className={`absolute top - 1 left - 1 w - 4 h - 4 rounded - full bg - white transition - transform ${autoGainControl ? 'translate-x-4' : 'translate-x-0'} `} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Notifications Panel - Sound settings
 */
function NotificationsPanel({
    soundsEnabled,
    onSoundsToggle,
}: {
    soundsEnabled: boolean;
    onSoundsToggle: (enabled: boolean) => void;
}) {
    return (
        <div>
            <h2 className="text-xl font-bold text-text-heading mb-5">Notifications</h2>

            <div className="space-y-4">
                {/* Enable Sounds Toggle */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-text-heading">Enable Sounds</h3>
                            <p className="text-sm text-text-muted mt-1">
                                Play notification sounds for messages, calls, and other events.
                            </p>
                        </div>
                        <button
                            onClick={() => onSoundsToggle(!soundsEnabled)}
                            className={`relative w - 12 h - 6 rounded - full transition - colors ${soundsEnabled ? 'bg-green-500' : 'bg-gray-600'
                                } `}
                        >
                            <div
                                className={`absolute top - 0.5 left - 0.5 w - 5 h - 5 bg - white rounded - full transition - transform ${soundsEnabled ? 'translate-x-6' : 'translate-x-0'
                                    } `}
                            />
                        </button>
                    </div>
                </div>

                {/* Message Notifications */}
                <div className="bg-[#232428] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-text-heading">Message Notifications</h3>
                            <p className="text-sm text-text-muted mt-1">
                                Play a sound when you receive a new message.
                            </p>
                        </div>
                        <button
                            className="relative w-12 h-6 rounded-full transition-colors bg-green-500"
                        >
                            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
