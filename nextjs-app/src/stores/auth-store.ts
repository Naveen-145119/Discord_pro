'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

// MOCK AUTH STORE - Uses localStorage for testing without Appwrite
// Switch to real auth-store.ts when connecting to Appwrite backend

interface MockUser extends User {
    password?: string; // Only stored locally for mock
}

interface AuthState {
    user: User | null;
    sessionId: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;
    isUpdatingProfile: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => Promise<void>;
    checkSession: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    updateStatus: (status: 'online' | 'idle' | 'dnd' | 'offline') => Promise<void>;
    clearError: () => void;
}

// Get stored users from localStorage
function getStoredUsers(): MockUser[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('mock-users');
    return stored ? JSON.parse(stored) : [];
}

// Save users to localStorage
function saveStoredUsers(users: MockUser[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mock-users', JSON.stringify(users));
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            sessionId: null,
            isLoading: false, // Start as false for mock
            isAuthenticated: false,
            error: null,
            isUpdatingProfile: false,

            login: async (email, password) => {
                set({ isLoading: true, error: null });

                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const users = getStoredUsers();
                    const user = users.find(u => u.email === email);

                    if (!user) {
                        throw new Error('User not found. Please register first.');
                    }

                    if (user.password !== password) {
                        throw new Error('Invalid password');
                    }

                    // Create session
                    const sessionId = `session-${Date.now()}`;

                    // Remove password from user object before storing in state
                    const { password: _, ...safeUser } = user;

                    set({
                        user: { ...safeUser, status: 'online' } as User,
                        sessionId,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Login failed';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            register: async (email, password, username) => {
                set({ isLoading: true, error: null });

                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const users = getStoredUsers();

                    // Check if email already exists
                    if (users.some(u => u.email === email)) {
                        throw new Error('Email already registered');
                    }

                    // Check if username already exists
                    if (users.some(u => u.username === username)) {
                        throw new Error('Username already taken');
                    }

                    // Create new user
                    const newUser: MockUser = {
                        $id: `user-${Date.now()}`,
                        $createdAt: new Date().toISOString(),
                        $updatedAt: new Date().toISOString(),
                        username,
                        displayName: username,
                        email,
                        avatarUrl: null,
                        bannerUrl: null,
                        bio: null,
                        status: 'online',
                        customStatus: null,
                        password, // Store password for mock login
                    };

                    // Save user
                    saveStoredUsers([...users, newUser]);

                    // Auto-login after registration
                    await get().login(email, password);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Registration failed';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            logout: async () => {
                set({
                    user: null,
                    sessionId: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            },

            checkSession: async () => {
                // For mock, just check if we have a stored session
                const { sessionId, user } = get();

                if (sessionId && user) {
                    set({ isAuthenticated: true, isLoading: false });
                } else {
                    set({ isAuthenticated: false, isLoading: false });
                }
            },

            updateUser: (updates) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null,
                }));
            },

            updateStatus: async (status) => {
                const { user } = get();
                if (!user) return;
                set({ user: { ...user, status } });
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'discord-auth-mock',
            partialize: (state) => ({
                user: state.user,
                sessionId: state.sessionId,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
