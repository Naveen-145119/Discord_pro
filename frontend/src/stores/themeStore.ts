import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'midnight';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'dark',

            setTheme: (theme) => {
                // Update the data-theme attribute on the html element
                document.documentElement.setAttribute('data-theme', theme);
                set({ theme });
            },
        }),
        {
            name: 'discord-theme',
            onRehydrateStorage: () => (state) => {
                // Apply theme on rehydration
                if (state?.theme) {
                    document.documentElement.setAttribute('data-theme', state.theme);
                }
            },
        }
    )
);

// Initialize theme on module load
if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('discord-theme');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.state?.theme) {
                document.documentElement.setAttribute('data-theme', parsed.state.theme);
            }
        } catch {
            // Use default dark theme
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
}
