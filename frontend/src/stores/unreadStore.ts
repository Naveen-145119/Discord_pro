import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UnreadState {
    // Map of channelId -> lastReadTimestamp (ISO string)
    lastReadTimestamps: Record<string, string>;
    // Map of channelId -> unread count
    unreadCounts: Record<string, number>;
    // Mark a channel as read
    markAsRead: (channelId: string) => void;
    // Increment unread count for a channel
    incrementUnread: (channelId: string) => void;
    // Check if channel has unreads
    hasUnread: (channelId: string, lastMessageTimestamp?: string) => boolean;
    // Get unread count for a channel
    getUnreadCount: (channelId: string) => number;
    // Check if any channel in a server has unreads
    hasServerUnread: (channelIds: string[]) => boolean;
}

export const useUnreadStore = create<UnreadState>()(
    persist(
        (set, get) => ({
            lastReadTimestamps: {},
            unreadCounts: {},

            markAsRead: (channelId) => {
                set((state) => ({
                    lastReadTimestamps: {
                        ...state.lastReadTimestamps,
                        [channelId]: new Date().toISOString(),
                    },
                    unreadCounts: {
                        ...state.unreadCounts,
                        [channelId]: 0,
                    },
                }));
            },

            incrementUnread: (channelId) => {
                set((state) => ({
                    unreadCounts: {
                        ...state.unreadCounts,
                        [channelId]: (state.unreadCounts[channelId] || 0) + 1,
                    },
                }));
            },

            hasUnread: (channelId, lastMessageTimestamp) => {
                const { lastReadTimestamps, unreadCounts } = get();

                // If we have unread count, use that
                if (unreadCounts[channelId] && unreadCounts[channelId] > 0) {
                    return true;
                }

                // If we have a last message timestamp, compare with last read
                if (lastMessageTimestamp) {
                    const lastRead = lastReadTimestamps[channelId];
                    if (!lastRead) return true; // Never read = has unreads
                    return new Date(lastMessageTimestamp) > new Date(lastRead);
                }

                return false;
            },

            getUnreadCount: (channelId) => {
                return get().unreadCounts[channelId] || 0;
            },

            hasServerUnread: (channelIds) => {
                const { unreadCounts } = get();
                return channelIds.some((id) => unreadCounts[id] && unreadCounts[id] > 0);
            },
        }),
        {
            name: 'discord-unread',
        }
    )
);
