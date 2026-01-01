import { useState, useEffect, useCallback } from 'react';
import { databases, functions, client, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import type { User, DMChannel } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface DMChannelWithFriend extends DMChannel {
    friend: User;
}

interface UseDMsReturn {
    // State
    dmChannels: DMChannelWithFriend[];
    isLoading: boolean;
    error: string | null;

    // Actions
    createOrGetDM: (friendId: string) => Promise<DMChannelWithFriend>;
    refresh: () => Promise<void>;
}

/**
 * Custom hook for managing DM channels
 */
export function useDMs(): UseDMsReturn {
    const { user } = useAuthStore();
    const [dmChannels, setDmChannels] = useState<DMChannelWithFriend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all DM channels for the current user
    const fetchDMs = useCallback(async () => {
        if (!user?.$id) return;

        try {
            setIsLoading(true);

            // Query DM channels where user is a participant
            const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DM_CHANNELS, [
                Query.contains('participantIds', user.$id),
                Query.orderDesc('lastMessageAt'),
                Query.limit(50)
            ]);

            const channels = result.documents as unknown as DMChannel[];

            // Get all friend IDs (the other participant)
            // participantIds is stored as JSON string in Appwrite, so parse it
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

            // Fetch friend details
            let friendsMap = new Map<string, User>();
            if (friendIds.size > 0) {
                const friends = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
                    Query.equal('$id', Array.from(friendIds)),
                    Query.limit(50)
                ]);
                friendsMap = new Map(friends.documents.map(f => [f.$id, f as unknown as User]));
            }

            // Combine channels with friend data
            const channelsWithFriends: DMChannelWithFriend[] = channels.map(channel => {
                const participants = typeof channel.participantIds === 'string'
                    ? JSON.parse(channel.participantIds)
                    : channel.participantIds;
                const friendId = participants.find((id: string) => id !== user.$id)!;
                const friend = friendsMap.get(friendId);
                return {
                    ...channel,
                    participantIds: participants, // Ensure it's always an array
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

    // Create or get existing DM channel
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

            // If it's a new channel, add it to the list
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

    // Refresh DMs
    const refresh = useCallback(async () => {
        await fetchDMs();
    }, [fetchDMs]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!user?.$id) return;

        // Subscribe to DM channel updates
        const unsubscribe = client.subscribe(
            `databases.${DATABASE_ID}.collections.${COLLECTIONS.DM_CHANNELS}.documents`,
            (response) => {
                const event = response.events[0];
                const document = response.payload as unknown as DMChannel;

                // Only process if user is a participant
                if (!document.participantIds?.includes(user.$id)) return;

                if (event.includes('.create') || event.includes('.update')) {
                    // Refresh to get updated data with friend info
                    fetchDMs();
                } else if (event.includes('.delete')) {
                    setDmChannels(prev => prev.filter(dm => dm.$id !== document.$id));
                }
            }
        );

        return () => {
            unsubscribe();
        };
    }, [user?.$id, fetchDMs]);

    // Initial load
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
