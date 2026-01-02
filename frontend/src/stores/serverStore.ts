import { create } from 'zustand';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import type { Server, ServerMember, Channel, Role } from '@/types';
import { ID, Query } from 'appwrite';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions';

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
    updateServer: (serverId: string, updates: Partial<Server>) => Promise<void>;
    deleteServer: (serverId: string) => Promise<void>;
    joinServer: (serverId: string, userId: string) => Promise<void>;
    leaveServer: (serverId: string, userId: string) => Promise<void>;
    reorderChannels: (serverId: string, userId: string, updates: ChannelReorderItem[]) => Promise<void>;
    setCurrentServer: (server: Server | null) => void;
    clearError: () => void;
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

        try {
            const memberships = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                [Query.equal('userId', userId), Query.limit(100)]
            );

            if (memberships.documents.length === 0) {
                set({ servers: [], isLoading: false });
                return;
            }

            const serverIds = memberships.documents.map((m) => (m as unknown as { serverId: string }).serverId);
            const servers = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                [Query.equal('$id', serverIds), Query.limit(100)]
            );

            set({ servers: servers.documents as unknown as Server[], isLoading: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch servers';
            set({ error: message, isLoading: false });
        }
    },

    fetchServerDetails: async (serverId) => {
        set({ isLoading: true, error: null });

        try {
            const server = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                serverId
            ) as unknown as Server;

            const channels = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.CHANNELS,
                [
                    Query.equal('serverId', serverId),
                    Query.orderAsc('position'),
                    Query.limit(100)
                ]
            );

            const members = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                [Query.equal('serverId', serverId), Query.limit(100)]
            );

            const roles = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.ROLES,
                [Query.equal('serverId', serverId), Query.orderAsc('position'), Query.limit(100)]
            );

            set({
                currentServer: server,
                channels: channels.documents as unknown as Channel[],
                members: members.documents as unknown as ServerMember[],
                roles: roles.documents as unknown as Role[],
                isLoading: false,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch server details';
            set({ error: message, isLoading: false });
        }
    },

    createServer: async (name, ownerId) => {
        set({ isLoading: true, error: null });

        try {
            const server = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                ID.unique(),
                {
                    name,
                    description: null,
                    iconUrl: null,
                    bannerUrl: null,
                    ownerId,
                    isPublic: false,
                    verificationLevel: 0,
                    memberCount: 1,
                    defaultChannelId: null,
                }
            ) as unknown as Server;

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.ROLES,
                ID.unique(),
                {
                    serverId: server.$id,
                    name: '@everyone',
                    color: '#99AAB5',
                    position: 0,
                    permissions: DEFAULT_PERMISSIONS.toString(),
                    isHoisted: false,
                    isMentionable: false,
                }
            );

            const defaultChannel = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.CHANNELS,
                ID.unique(),
                {
                    serverId: server.$id,
                    type: 'text',
                    name: 'general',
                    topic: null,
                    position: 0,
                    parentId: null,
                    isNsfw: false,
                    slowmodeSeconds: 0,
                    userLimit: null,
                }
            ) as unknown as Channel;

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                server.$id,
                { defaultChannelId: defaultChannel.$id }
            );

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                ID.unique(),
                {
                    serverId: server.$id,
                    userId: ownerId,
                    nickname: null,
                    roleIds: JSON.stringify([]),
                    joinedAt: new Date().toISOString(),
                    permissionBits: DEFAULT_PERMISSIONS.toString(),
                }
            );

            set((state) => ({
                servers: [...state.servers, { ...server, defaultChannelId: defaultChannel.$id }],
                isLoading: false,
            }));

            return { ...server, defaultChannelId: defaultChannel.$id };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create server';
            set({ error: message, isLoading: false });
            throw error;
        }
    },

    updateServer: async (serverId, updates) => {
        try {
            const updated = await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                serverId,
                updates
            ) as unknown as Server;

            set((state) => ({
                servers: state.servers.map((s) => s.$id === serverId ? updated : s),
                currentServer: state.currentServer?.$id === serverId ? updated : state.currentServer,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update server';
            set({ error: message });
            throw error;
        }
    },

    deleteServer: async (serverId) => {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SERVERS, serverId);

            set((state) => ({
                servers: state.servers.filter((s) => s.$id !== serverId),
                currentServer: state.currentServer?.$id === serverId ? null : state.currentServer,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete server';
            set({ error: message });
            throw error;
        }
    },

    joinServer: async (serverId, userId) => {
        try {
            const existing = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                [
                    Query.equal('serverId', serverId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]
            );

            if (existing.documents.length > 0) {
                throw new Error('Already a member of this server');
            }

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                ID.unique(),
                {
                    serverId,
                    userId,
                    nickname: null,
                    roleIds: JSON.stringify([]),
                    joinedAt: new Date().toISOString(),
                    permissionBits: DEFAULT_PERMISSIONS.toString(),
                }
            );

            const server = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                serverId
            ) as unknown as Server;

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                serverId,
                { memberCount: server.memberCount + 1 }
            );

            await get().fetchServers(userId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to join server';
            set({ error: message });
            throw error;
        }
    },

    leaveServer: async (serverId, userId) => {
        try {
            const memberships = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                [
                    Query.equal('serverId', serverId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]
            );

            if (memberships.documents.length === 0) {
                throw new Error('Not a member of this server');
            }

            const server = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                serverId
            ) as unknown as Server;

            if (server.ownerId === userId) {
                throw new Error('Server owner cannot leave. Transfer ownership or delete the server.');
            }

            await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.SERVER_MEMBERS,
                memberships.documents[0].$id
            );

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SERVERS,
                serverId,
                { memberCount: Math.max(0, server.memberCount - 1) }
            );

            set((state) => ({
                servers: state.servers.filter((s) => s.$id !== serverId),
                currentServer: state.currentServer?.$id === serverId ? null : state.currentServer,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to leave server';
            set({ error: message });
            throw error;
        }
    },

    setCurrentServer: (server) => set({ currentServer: server }),

    reorderChannels: async (serverId, userId, updates) => {
        // Store previous state for rollback
        const previousChannels = [...get().channels];

        // Optimistic update
        set((state) => ({
            channels: state.channels.map((channel) => {
                const update = updates.find((u) => u.id === channel.$id);
                if (update) {
                    return {
                        ...channel,
                        position: update.position,
                        parentId: update.parentId,
                    };
                }
                return channel;
            }).sort((a, b) => a.position - b.position),
        }));

        try {
            await functions.createExecution(
                'reorder-channels',
                JSON.stringify({ serverId, userId, channels: updates }),
                false
            );
        } catch (error) {
            // Rollback on failure
            set({ channels: previousChannels });
            const message = error instanceof Error ? error.message : 'Failed to reorder channels';
            set({ error: message });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
