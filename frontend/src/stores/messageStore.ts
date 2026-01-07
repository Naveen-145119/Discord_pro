import { create } from 'zustand';
import { databases, DATABASE_ID, COLLECTIONS, client } from '@/lib/appwrite';
import type { Message, Channel } from '@/types';
import { ID, Query } from 'appwrite';
import DOMPurify from 'dompurify';

const MESSAGES_PER_PAGE = 50;

interface MessageState {
    messages: Message[];
    currentChannel: Channel | null;
    replyingTo: Message | null;
    hasMore: boolean;
    isLoading: boolean;
    isSending: boolean;
    error: string | null;
    typingUsers: Map<string, { username: string; expiresAt: number }>;
    fetchMessages: (channelId: string, cursor?: string) => Promise<void>;
    sendMessage: (channelId: string, authorId: string, content: string, replyToId?: string) => Promise<Message>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    addMessage: (message: Message) => void;
    updateMessage: (message: Message) => void;
    removeMessage: (messageId: string) => void;
    setCurrentChannel: (channel: Channel | null) => void;
    setReplyingTo: (message: Message | null) => void;
    clearReplyingTo: () => void;
    addTypingUser: (userId: string, username: string) => void;
    removeTypingUser: (userId: string) => void;
    clearMessages: () => void;
    clearError: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
    messages: [],
    currentChannel: null,
    replyingTo: null,
    hasMore: true,
    isLoading: false,
    isSending: false,
    error: null,
    typingUsers: new Map(),

    fetchMessages: async (channelId, cursor) => {
        set({ isLoading: true, error: null });

        try {
            const queries = [
                Query.equal('channelId', channelId),
                Query.orderDesc('$createdAt'),
                Query.limit(MESSAGES_PER_PAGE + 1),
            ];

            if (cursor) {
                queries.push(Query.cursorBefore(cursor));
            }

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.MESSAGES,
                queries
            );

            const hasMore = response.documents.length > MESSAGES_PER_PAGE;
            const rawMessages = response.documents.slice(0, MESSAGES_PER_PAGE) as unknown as Message[];

            const newMessages = rawMessages.map(msg => {
                if (msg.metadata) {
                    try {
                        const { embeds, reactions, mentionRoleIds } = JSON.parse(msg.metadata);
                        return { ...msg, embeds, reactions, mentionRoleIds };
                    } catch {
                        return { ...msg, embeds: [], reactions: [], mentionRoleIds: [] };
                    }
                }
                return { ...msg, embeds: [], reactions: [], mentionRoleIds: [] };
            });

            set((state) => ({
                messages: cursor
                    ? [...state.messages, ...newMessages]
                    : newMessages,
                hasMore,
                isLoading: false,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch messages';
            set({ error: message, isLoading: false });
        }
    },

    sendMessage: async (channelId, authorId, content, replyToId) => {
        if (!content.trim()) {
            throw new Error('Message cannot be empty');
        }

        if (content.length > 4000) {
            throw new Error('Message exceeds 4000 characters');
        }

        set({ isSending: true, error: null });

        // Sanitize content to prevent XSS attacks
        const sanitizedContent = DOMPurify.sanitize(content.trim(), {
            ALLOWED_TAGS: [], // Strip all HTML tags for plain text messages
            ALLOWED_ATTR: []
        });

        try {
            const message = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.MESSAGES,
                ID.unique(),
                {
                    channelId,
                    authorId,
                    content: sanitizedContent,
                    type: replyToId ? 'reply' : 'default',
                    replyToId: replyToId ?? null,
                    attachments: JSON.stringify([]),
                    metadata: JSON.stringify({
                        embeds: [],
                        reactions: [],
                        mentionRoleIds: []
                    }),
                    mentionUserIds: JSON.stringify([]),
                    mentionEveryone: false,
                    isPinned: false,
                    isEdited: false,
                    editedAt: null,
                }
            ) as unknown as Message;

            set({ isSending: false });
            return message;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            set({ error: errorMessage, isSending: false });
            throw error;
        }
    },

    editMessage: async (messageId, content) => {
        if (!content.trim()) {
            throw new Error('Message cannot be empty');
        }

        try {
            // Sanitize content to prevent XSS attacks
            const sanitizedContent = DOMPurify.sanitize(content.trim(), {
                ALLOWED_TAGS: [], // Strip all HTML tags for plain text messages
                ALLOWED_ATTR: []
            });

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.MESSAGES,
                messageId,
                {
                    content: sanitizedContent,
                    isEdited: true,
                    editedAt: new Date().toISOString(),
                }
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
            set({ error: errorMessage });
            throw error;
        }
    },

    deleteMessage: async (messageId) => {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MESSAGES, messageId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
            set({ error: errorMessage });
            throw error;
        }
    },

    addMessage: (message) => {
        set((state) => {
            if (state.messages.some((m) => m.$id === message.$id)) {
                return state;
            }

            return { messages: [message, ...state.messages] };
        });
    },

    updateMessage: (message) => {
        set((state) => ({
            messages: state.messages.map((m) =>
                m.$id === message.$id ? message : m
            ),
        }));
    },

    removeMessage: (messageId) => {
        set((state) => ({
            messages: state.messages.filter((m) => m.$id !== messageId),
        }));
    },

    setCurrentChannel: (channel) => {
        set({
            currentChannel: channel,
            messages: [],
            hasMore: true,
            replyingTo: null,
            typingUsers: new Map(),
        });
    },

    setReplyingTo: (message) => set({ replyingTo: message }),

    clearReplyingTo: () => set({ replyingTo: null }),

    addTypingUser: (userId, username) => {
        set((state) => {
            const newMap = new Map(state.typingUsers);
            newMap.set(userId, {
                username,
                expiresAt: Date.now() + 10000
            });
            return { typingUsers: newMap };
        });

        setTimeout(() => {
            get().removeTypingUser(userId);
        }, 10000);
    },

    removeTypingUser: (userId) => {
        set((state) => {
            const newMap = new Map(state.typingUsers);
            newMap.delete(userId);
            return { typingUsers: newMap };
        });
    },

    clearMessages: () => set({
        messages: [],
        hasMore: true,
        currentChannel: null,
        typingUsers: new Map(),
    }),

    clearError: () => set({ error: null }),
}));

export function subscribeToMessages(channelId: string) {
    const channel = `databases.${DATABASE_ID}.collections.${COLLECTIONS.MESSAGES}.documents`;

    return client.subscribe(channel, (response: { events: string[]; payload: unknown }) => {
        const payload = response.payload as Message | undefined;

        // Safety: Ensure payload exists and belongs to current channel
        if (!payload?.$id || !payload?.channelId || payload.channelId !== channelId) return;

        const eventType = response.events[0];

        if (eventType.includes('.create')) {
            useMessageStore.getState().addMessage(payload);
        } else if (eventType.includes('.update')) {
            useMessageStore.getState().updateMessage(payload);
        } else if (eventType.includes('.delete')) {
            useMessageStore.getState().removeMessage(payload.$id);
        }
    });
}
