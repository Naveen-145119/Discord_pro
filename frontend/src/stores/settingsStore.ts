import { create } from 'zustand';

export type SettingsTab =
    | 'my-account'
    | 'profiles'
    | 'appearance'
    | 'voice-video'
    | 'notifications';

interface SettingsState {
    isOpen: boolean;
    activeTab: SettingsTab;
    soundsEnabled: boolean;
    openSettings: (tab?: SettingsTab) => void;
    closeSettings: () => void;
    setActiveTab: (tab: SettingsTab) => void;
    setSoundsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    isOpen: false,
    activeTab: 'my-account',
    soundsEnabled: true,

    openSettings: (tab = 'my-account') => set({ isOpen: true, activeTab: tab }),
    closeSettings: () => set({ isOpen: false }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSoundsEnabled: (enabled) => set({ soundsEnabled: enabled }),
}));
