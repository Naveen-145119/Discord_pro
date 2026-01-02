import { useState, useEffect, useCallback } from 'react';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import type { User, DMChannel } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useRealtime } from '@/providers/RealtimeProvider';

interface DMChannelWithFriend extends DMChannel {
    friend: User;
}

interface UseDMsReturn {
    dmChannels: DMChannelWithFriend[];
    isLoading: boolean;
    error: string | null;
    createOrGetDM: (friendId: string) => Promise<DMChannelWithFriend>;
    refresh: () => Promise<void>;
}

export function useDMs(): UseDMsReturn {
    const { user } = useAuthStore();
    const [dmChannels, setDmChannels] = useState<DMChannelWithFriend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDMs = useCallback(async () => {
        if (!user?.$id) return;

        try {
            setIsLoading(true);

            const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DM_CHANNELS, [
                Query.contains('participantIds', user.$id),
                Query.orderDesc('lastMessageAt'),
                Query.limit(50)
            ]);

            const channels = result.documents as unknown as DMChannel[];

            const friendIds = new Set<string>();
            channels.forEach(channel => {
                const participants = typeof channel.participantIds === 'string'
                    ? JSON.parse(channel.participantIds)
                    : channel.participantIds;
                participants.forEach((id: string) => {
                    if (id !== user.$id) {
                        friendIds.add(id);
                    }
                });
            });

            let friendsMap = new Map<string, User>();
            if (friendIds.size > 0) {
                const friends = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
                    Query.equal('$id', Array.from(friendIds)),
                    Query.limit(50)
                ]);
                friendsMap = new Map(friends.documents.map(f => [f.$id, f as unknown as User]));
            }

            const channelsWithFriends: DMChannelWithFriend[] = channels.map(channel => {
                const participants = typeof channel.participantIds === 'string'
                    ? JSON.parse(channel.participantIds)
                    : channel.participantIds;
                const friendId = participants.find((id: string) => id !== user.$id)!;
                const friend = friendsMap.get(friendId);
                return {
                    ...channel,
                    participantIds: participants,
                    friend: friend || {
                        $id: friendId,
                        username: 'Unknown',
                        displayName: 'Unknown User',
                        email: '',
                        avatarUrl: null,
                        bannerUrl: null,
                        bio: null,
                        status: 'offline' as const,
                        customStatus: null,
                        $createdAt: '',
                        $updatedAt: ''
                    }
                };
            });

            setDmChannels(channelsWithFriends);
            setError(null);
        } catch (err) {
            console.error('Error fetching DMs:', err);
            setError('Failed to load conversations');
        } finally {
            setIsLoading(false);
        }
    }, [user?.$id]);

    const createOrGetDM = useCallback(async (friendId: string): Promise<DMChannelWithFriend> => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            const result = await functions.createExecution(
                'create-dm-channel',
                JSON.stringify({ userId: user.$id, friendId }),
                false
            );

            const response = JSON.parse(result.responseBody);
            if (!response.success) {
                throw new Error(response.error || 'Failed to create DM channel');
            }

            const dmChannel: DMChannelWithFriend = {
                ...response.data,
                friend: response.data.friend
            };

            if (response.isNew) {
                setDmChannels(prev => [dmChannel, ...prev]);
            }

            return dmChannel;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create DM';
            setError(message);
            throw err;
        }
    }, [user?.$id]);

    const refresh = useCallback(async () => {
        await fetchDMs();
    }, [fetchDMs]);

    const { subscribe } = useRealtime();

    useEffect(() => {
        if (!user?.$id) return;

        const unsubscribe = subscribe((event) => {
            if (event.collection !== COLLECTIONS.DM_CHANNELS) return;

            const document = event.payload as DMChannel;

            if (!document.participantIds?.includes(user.$id)) return;

            if (event.event.includes('.create') || event.event.includes('.update')) {
                fetchDMs();
            } else if (event.event.includes('.delete')) {
                setDmChannels(prev => prev.filter(dm => dm.$id !== document.$id));
            }
        });

        return unsubscribe;
    }, [user?.$id, fetchDMs, subscribe]);

    useEffect(() => {
        if (user?.$id) {
            fetchDMs();
        }
    }, [user?.$id, fetchDMs]);

    return {
        dmChannels,
        isLoading,
        error,
        createOrGetDM,
        refresh
    };
}
