'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import type { Message, User } from '@/types';
import { ID, Query } from 'appwrite';
import DOMPurify from 'dompurify';

const MESSAGES_PER_PAGE = 50;

// Sanitize message content
function sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content.trim());
}

// Fetch messages with cursor-based pagination (Blueprint Section 2.5)
async function fetchMessages(channelId: string, cursor?: string): Promise<{
    messages: Message[];
    nextCursor: string | null;
}> {
    const queries = [
        Query.equal('channelId', channelId),
        Query.orderDesc('$createdAt'),
        Query.limit(MESSAGES_PER_PAGE),
    ];

    if (cursor) {
        queries.push(Query.cursorAfter(cursor));
    }

    const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.MESSAGES,
        queries
    );

    const messages = response.documents as unknown as Message[];
    const nextCursor = messages.length === MESSAGES_PER_PAGE
        ? messages[messages.length - 1].$id
        : null;

    return { messages, nextCursor };
}

// React Query hook for infinite scroll messages (Blueprint Section 4.2)
export function useMessages(channelId: string) {
    return useInfiniteQuery({
        queryKey: ['messages', channelId],
        queryFn: ({ pageParam }) => fetchMessages(channelId, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: !!channelId,
        staleTime: 1000 * 30, // 30 seconds
    });
}

// Send message mutation with optimistic update (Blueprint Section 4.3)
export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            channelId,
            authorId,
            content,
            replyToId,
            author,
        }: {
            channelId: string;
            authorId: string;
            content: string;
            replyToId?: string;
            author?: User;
        }) => {
            const sanitizedContent = sanitizeContent(content);

            const message = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.MESSAGES,
                ID.unique(),
                {
                    channelId,
                    authorId,
                    content: sanitizedContent,
                    type: replyToId ? 'reply' : 'default',
                    replyToId: replyToId || null,
                    attachments: JSON.stringify([]),
                    embeds: JSON.stringify([]),
                    reactions: JSON.stringify([]),
                    mentionRoleIds: JSON.stringify([]),
                    mentionUserIds: JSON.stringify([]),
                    mentionEveryone: false,
                    isPinned: false,
                    isEdited: false,
                    editedAt: null,
                }
            ) as unknown as Message;

            return { ...message, author };
        },

        // Optimistic update
        onMutate: async ({ channelId, authorId, content, author }) => {
            await queryClient.cancelQueries({ queryKey: ['messages', channelId] });

            const previousMessages = queryClient.getQueryData(['messages', channelId]);

            // Create optimistic message
            const optimisticMessage: Message = {
                $id: `temp-${Date.now()}`,
                $createdAt: new Date().toISOString(),
                $updatedAt: new Date().toISOString(),
                channelId,
                authorId,
                content: sanitizeContent(content),
                type: 'default',
                replyToId: null,
                attachments: [],
                embeds: [],
                reactions: [],
                mentionRoleIds: [],
                mentionUserIds: [],
                mentionEveryone: false,
                isPinned: false,
                isEdited: false,
                editedAt: null,
                author,
            };

            queryClient.setQueryData(['messages', channelId], (old: unknown) => {
                if (!old) return { pages: [{ messages: [optimisticMessage], nextCursor: null }], pageParams: [] };
                const data = old as { pages: { messages: Message[] }[] };
                return {
                    ...data,
                    pages: data.pages.map((page, i) =>
                        i === 0 ? { ...page, messages: [optimisticMessage, ...page.messages] } : page
                    ),
                };
            });

            return { previousMessages };
        },

        onError: (_, { channelId }, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(['messages', channelId], context.previousMessages);
            }
        },

        onSettled: (_, __, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
        },
    });
}

// Edit message mutation
export function useEditMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            messageId,
            content,
            channelId,
        }: {
            messageId: string;
            content: string;
            channelId: string;
        }) => {
            const sanitizedContent = sanitizeContent(content);

            const updated = await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.MESSAGES,
                messageId,
                {
                    content: sanitizedContent,
                    isEdited: true,
                    editedAt: new Date().toISOString(),
                }
            ) as unknown as Message;

            return updated;
        },

        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
        },
    });
}

// Delete message mutation
export function useDeleteMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            messageId,
            channelId,
        }: {
            messageId: string;
            channelId: string;
        }) => {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MESSAGES, messageId);
            return { messageId, channelId };
        },

        // Optimistic delete
        onMutate: async ({ messageId, channelId }) => {
            await queryClient.cancelQueries({ queryKey: ['messages', channelId] });

            const previousMessages = queryClient.getQueryData(['messages', channelId]);

            queryClient.setQueryData(['messages', channelId], (old: unknown) => {
                if (!old) return old;
                const data = old as { pages: { messages: Message[] }[] };
                return {
                    ...data,
                    pages: data.pages.map((page) => ({
                        ...page,
                        messages: page.messages.filter((m) => m.$id !== messageId),
                    })),
                };
            });

            return { previousMessages };
        },

        onError: (_, { channelId }, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(['messages', channelId], context.previousMessages);
            }
        },
    });
}
