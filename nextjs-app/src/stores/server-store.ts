'use client';

import { create } from 'zustand';
import type { Server, ServerMember, Channel, Role } from '@/types';

// MOCK SERVER STORE - Uses localStorage for testing without Appwrite

export interface ChannelReorderItem {
    id: string;
    position: number;
    parentId: string | null;
}

interface ServerState {
    servers: Server[];
    currentServer: Server | null;
    members: ServerMember[];
    channels: Channel[];
    roles: Role[];
    isLoading: boolean;
    error: string | null;
    fetchServers: (userId: string) => Promise<void>;
    fetchServerDetails: (serverId: string) => Promise<void>;
    createServer: (name: string, ownerId: string) => Promise<Server>;
    setCurrentServer: (server: Server | null) => void;
    clearError: () => void;
}

// Get stored servers from localStorage
function getStoredServers(): Server[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('mock-servers');
    if (stored) return JSON.parse(stored);

    // Create default test servers
    const defaultServers: Server[] = [
        {
            $id: 'server-1',
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            name: 'Test Server',
            description: 'A test server for development',
            iconUrl: null,
            bannerUrl: null,
            ownerId: 'user-1',
            isPublic: false,
            verificationLevel: 0,
            memberCount: 1,
            defaultChannelId: 'channel-1',
        },
        {
            $id: 'server-2',
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            name: 'Gaming Hub',
            description: 'For gamers',
            iconUrl: null,
            bannerUrl: null,
            ownerId: 'user-1',
            isPublic: true,
            verificationLevel: 0,
            memberCount: 5,
            defaultChannelId: 'channel-3',
        },
    ];

    localStorage.setItem('mock-servers', JSON.stringify(defaultServers));
    return defaultServers;
}

// Get channels for a server
function getStoredChannels(serverId: string): Channel[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(`mock-channels-${serverId}`);
    if (stored) return JSON.parse(stored);

    // Create default channels
    const defaultChannels: Channel[] = [
        {
            $id: `${serverId}-channel-1`,
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            serverId,
            type: 'text',
            name: 'general',
            topic: 'General discussion',
            position: 0,
            parentId: null,
            isNsfw: false,
            slowmodeSeconds: 0,
            userLimit: null,
        },
        {
            $id: `${serverId}-channel-2`,
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            serverId,
            type: 'text',
            name: 'random',
            topic: 'Random stuff',
            position: 1,
            parentId: null,
            isNsfw: false,
            slowmodeSeconds: 0,
            userLimit: null,
        },
        {
            $id: `${serverId}-voice-1`,
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            serverId,
            type: 'voice',
            name: 'General Voice',
            topic: null,
            position: 2,
            parentId: null,
            isNsfw: false,
            slowmodeSeconds: 0,
            userLimit: 10,
        },
    ];

    localStorage.setItem(`mock-channels-${serverId}`, JSON.stringify(defaultChannels));
    return defaultChannels;
}

function saveStoredServers(servers: Server[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mock-servers', JSON.stringify(servers));
}

export const useServerStore = create<ServerState>((set, get) => ({
    servers: [],
    currentServer: null,
    members: [],
    channels: [],
    roles: [],
    isLoading: false,
    error: null,

    fetchServers: async (userId) => {
        set({ isLoading: true, error: null });

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));

        const servers = getStoredServers();
        set({ servers, isLoading: false });
    },

    fetchServerDetails: async (serverId) => {
        set({ isLoading: true, error: null });

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));

        const servers = getStoredServers();
        const server = servers.find(s => s.$id === serverId);
        const channels = getStoredChannels(serverId);

        set({
            currentServer: server || null,
            channels,
            isLoading: false,
        });
    },

    createServer: async (name, ownerId) => {
        set({ isLoading: true, error: null });

        await new Promise(resolve => setTimeout(resolve, 300));

        const newServer: Server = {
            $id: `server-${Date.now()}`,
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            name,
            description: null,
            iconUrl: null,
            bannerUrl: null,
            ownerId,
            isPublic: false,
            verificationLevel: 0,
            memberCount: 1,
            defaultChannelId: null,
        };

        const servers = getStoredServers();
        saveStoredServers([...servers, newServer]);

        set((state) => ({
            servers: [...state.servers, newServer],
            isLoading: false,
        }));

        return newServer;
    },

    setCurrentServer: (server) => set({ currentServer: server }),
    clearError: () => set({ error: null }),
}));
