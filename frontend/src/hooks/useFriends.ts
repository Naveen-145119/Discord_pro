import { useState, useEffect, useCallback } from 'react';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import type { User, Friend, FriendRequest } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface UseFriendsReturn {
    // State
    friends: User[];
    pendingRequests: FriendRequest[];
    sentRequests: FriendRequest[];
    isLoading: boolean;
    error: string | null;

    // Actions
    sendRequest: (username: string) => Promise<void>;
    acceptRequest: (requestId: string) => Promise<void>;
    declineRequest: (requestId: string) => Promise<void>;
    removeFriend: (friendId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Custom hook for managing friends and friend requests
 */
export function useFriends(): UseFriendsReturn {
    const { user } = useAuthStore();
    const [friends, setFriends] = useState<User[]>([]);
    const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all friends for the current user
    const fetchFriends = useCallback(async () => {
        if (!user?.$id) return;

        try {
            // Query friendships where user is either userId1 or userId2
            const [asUser1, asUser2] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.FRIENDS, [
                    Query.equal('userId1', user.$id),
                    Query.limit(100)
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.FRIENDS, [
                    Query.equal('userId2', user.$id),
                    Query.limit(100)
                ])
            ]);

            // Get friend user IDs
            const friendIds = new Set<string>();
            [...asUser1.documents, ...asUser2.documents].forEach((doc) => {
                const friendship = doc as unknown as Friend;
                const friendId = friendship.userId1 === user.$id
                    ? friendship.userId2
                    : friendship.userId1;
                friendIds.add(friendId);
            });

            // Fetch friend user details
            if (friendIds.size > 0) {
                const friendUsers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
                    Query.equal('$id', Array.from(friendIds)),
                    Query.limit(100)
                ]);
                setFriends(friendUsers.documents as unknown as User[]);
            } else {
                setFriends([]);
            }
        } catch (err) {
            console.error('Error fetching friends:', err);
            setError('Failed to load friends');
        }
    }, [user?.$id]);

    // Fetch pending friend requests (received by current user)
    const fetchPendingRequests = useCallback(async () => {
        if (!user?.$id) return;

        try {
            const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.FRIEND_REQUESTS, [
                Query.equal('receiverId', user.$id),
                Query.equal('status', 'pending'),
                Query.orderDesc('$createdAt'),
                Query.limit(50)
            ]);

            // Fetch sender details for each request
            const requests = result.documents as unknown as FriendRequest[];
            const senderIds = [...new Set(requests.map(r => r.senderId))];

            if (senderIds.length > 0) {
                const senders = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
                    Query.equal('$id', senderIds),
                    Query.limit(50)
                ]);
                const senderMap = new Map(senders.documents.map(s => [s.$id, s]));

                const requestsWithSenders = requests.map(r => ({
                    ...r,
                    sender: senderMap.get(r.senderId) as User | undefined
                }));
                setPendingRequests(requestsWithSenders);
            } else {
                setPendingRequests([]);
            }
        } catch (err) {
            console.error('Error fetching pending requests:', err);
        }
    }, [user?.$id]);

    // Fetch sent friend requests (by current user)
    const fetchSentRequests = useCallback(async () => {
        if (!user?.$id) return;

        try {
            const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.FRIEND_REQUESTS, [
                Query.equal('senderId', user.$id),
                Query.equal('status', 'pending'),
                Query.orderDesc('$createdAt'),
                Query.limit(50)
            ]);

            // Fetch receiver details for each request
            const requests = result.documents as unknown as FriendRequest[];
            const receiverIds = [...new Set(requests.map(r => r.receiverId))];

            if (receiverIds.length > 0) {
                const receivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
                    Query.equal('$id', receiverIds),
                    Query.limit(50)
                ]);
                const receiverMap = new Map(receivers.documents.map(r => [r.$id, r]));

                const requestsWithReceivers = requests.map(r => ({
                    ...r,
                    receiver: receiverMap.get(r.receiverId) as User | undefined
                }));
                setSentRequests(requestsWithReceivers);
            } else {
                setSentRequests([]);
            }
        } catch (err) {
            console.error('Error fetching sent requests:', err);
        }
    }, [user?.$id]);

    // Refresh all data
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        await Promise.all([fetchFriends(), fetchPendingRequests(), fetchSentRequests()]);
        setIsLoading(false);
    }, [fetchFriends, fetchPendingRequests, fetchSentRequests]);

    // Send friend request
    const sendRequest = useCallback(async (username: string) => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            const result = await functions.createExecution(
                'send-friend-request',
                JSON.stringify({ senderId: user.$id, receiverUsername: username }),
                false
            );

            const response = JSON.parse(result.responseBody);
            if (!response.success) {
                throw new Error(response.error || 'Failed to send friend request');
            }

            await fetchSentRequests();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send friend request';
            setError(message);
            throw err;
        }
    }, [user?.$id, fetchSentRequests]);

    // Accept friend request
    const acceptRequest = useCallback(async (requestId: string) => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            const result = await functions.createExecution(
                'accept-friend-request',
                JSON.stringify({ requestId, userId: user.$id }),
                false
            );

            const response = JSON.parse(result.responseBody);
            if (!response.success) {
                throw new Error(response.error || 'Failed to accept friend request');
            }

            await Promise.all([fetchFriends(), fetchPendingRequests()]);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to accept friend request';
            setError(message);
            throw err;
        }
    }, [user?.$id, fetchFriends, fetchPendingRequests]);

    // Decline friend request
    const declineRequest = useCallback(async (requestId: string) => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            const result = await functions.createExecution(
                'decline-friend-request',
                JSON.stringify({ requestId, userId: user.$id }),
                false
            );

            const response = JSON.parse(result.responseBody);
            if (!response.success) {
                throw new Error(response.error || 'Failed to decline friend request');
            }

            await fetchPendingRequests();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to decline friend request';
            setError(message);
            throw err;
        }
    }, [user?.$id, fetchPendingRequests]);

    // Remove friend
    const removeFriend = useCallback(async (friendId: string) => {
        if (!user?.$id) throw new Error('Not authenticated');

        try {
            const result = await functions.createExecution(
                'remove-friend',
                JSON.stringify({ userId: user.$id, friendId }),
                false
            );

            const response = JSON.parse(result.responseBody);
            if (!response.success) {
                throw new Error(response.error || 'Failed to remove friend');
            }

            await fetchFriends();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to remove friend';
            setError(message);
            throw err;
        }
    }, [user?.$id, fetchFriends]);

    // Initial data load
    useEffect(() => {
        if (user?.$id) {
            refresh();
        }
    }, [user?.$id, refresh]);

    return {
        friends,
        pendingRequests,
        sentRequests,
        isLoading,
        error,
        sendRequest,
        acceptRequest,
        declineRequest,
        removeFriend,
        refresh
    };
}
