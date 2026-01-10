'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { client, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@/types';

// Event types for realtime subscriptions (Blueprint Section 3.4)
type RealtimeEvent = {
    collection: string;
    event: 'create' | 'update' | 'delete';
    payload: unknown;
};

type RealtimeListener = (event: RealtimeEvent) => void;

interface RealtimeContextType {
    isConnected: boolean;
    subscribe: (listener: RealtimeListener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export function useRealtime() {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealtime must be used within RealtimeProvider');
    }
    return context;
}

interface RealtimeProviderProps {
    children: ReactNode;
}

// RealtimeProvider for Appwrite subscriptions (Blueprint Section 5)
export function RealtimeProvider({ children }: RealtimeProviderProps) {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [isConnected, setIsConnected] = useState(false);
    const listenersRef = useRef<Set<RealtimeListener>>(new Set());
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const subscribe = (listener: RealtimeListener) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    };

    useEffect(() => {
        if (!user?.$id) {
            setIsConnected(false);
            return;
        }

        const initTimeout = setTimeout(() => {
            // Subscribe to relevant collections
            const channels = [
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.MESSAGES}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.DM_CHANNELS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHANNELS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.SERVERS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.SERVER_MEMBERS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.ACTIVE_CALLS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.FRIENDS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.FRIEND_REQUESTS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.USERS}.documents`,
            ];

            try {
                unsubscribeRef.current = client.subscribe(channels, (response) => {
                    // Parse event
                    const event = response.events[0] || '';
                    const collectionMatch = event.match(/collections\.([^.]+)/);
                    const collection = collectionMatch?.[1] || '';

                    // Determine event type
                    let eventType: 'create' | 'update' | 'delete' = 'update';
                    if (event.includes('.create')) eventType = 'create';
                    else if (event.includes('.delete')) eventType = 'delete';

                    const realtimeEvent: RealtimeEvent = {
                        collection,
                        event: eventType,
                        payload: response.payload,
                    };

                    // Handle message events - invalidate React Query cache
                    if (collection === COLLECTIONS.MESSAGES) {
                        const message = response.payload as Message;
                        if (message.channelId) {
                            queryClient.invalidateQueries({
                                queryKey: ['messages', message.channelId]
                            });
                        }
                    }

                    // Notify all listeners
                    listenersRef.current.forEach((listener) => {
                        try {
                            listener(realtimeEvent);
                        } catch (err) {
                            console.error('Realtime listener error:', err);
                        }
                    });
                });

                setIsConnected(true);
                console.log('[RealtimeProvider] Connected');
            } catch (err) {
                console.error('[RealtimeProvider] Failed to subscribe:', err);
                setIsConnected(false);
            }
        }, 500);

        return () => {
            clearTimeout(initTimeout);
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            setIsConnected(false);
        };
    }, [user?.$id, queryClient]);

    return (
        <RealtimeContext.Provider value={{ isConnected, subscribe }}>
            {children}
        </RealtimeContext.Provider>
    );
}
