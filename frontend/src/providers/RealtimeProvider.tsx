/**
 * RealtimeProvider - Centralized Appwrite Realtime Subscription Manager
 * 
 * CRITICAL: Appwrite SDK creates NEW WebSocket connection each time subscribe() is called.
 * Multiple hooks subscribing = constant connection churn = "WebSocket closed before connection"
 * 
 * This provider manages ONE subscription with ALL channels to prevent this.
 * 
 * @see https://appwrite.io/docs/apis/realtime#subscription-changes
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { client, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useAuthStore } from '@/stores/authStore';

// Event types that components can subscribe to
type RealtimeEvent = {
    collection: string;
    event: string;
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

export function RealtimeProvider({ children }: RealtimeProviderProps) {
    const { user } = useAuthStore();
    const [isConnected, setIsConnected] = useState(false);
    const listenersRef = useRef<Set<RealtimeListener>>(new Set());
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Subscribe function for components to register listeners
    const subscribe = (listener: RealtimeListener) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    };

    // Create SINGLE subscription with ALL channels
    useEffect(() => {
        if (!user?.$id) {
            // Not authenticated - don't subscribe
            setIsConnected(false);
            return;
        }

        // Wait for session to be fully established
        const initTimeout = setTimeout(() => {
            // Define ALL channels we need in ONE array
            const channels = [
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.DM_CHANNELS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.MESSAGES}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.ACTIVE_CALLS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.WEBRTC_SIGNALS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.FRIENDS}.documents`,
                `databases.${DATABASE_ID}.collections.${COLLECTIONS.FRIEND_REQUESTS}.documents`,
            ];

            try {
                // ONE subscription with ALL channels
                unsubscribeRef.current = client.subscribe(channels, (response) => {
                    // Extract collection from events
                    const event = response.events[0] || '';
                    const collectionMatch = event.match(/collections\.([^.]+)/);
                    const collection = collectionMatch?.[1] || '';

                    const realtimeEvent: RealtimeEvent = {
                        collection,
                        event,
                        payload: response.payload,
                    };

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
                console.log('[RealtimeProvider] Connected with', channels.length, 'channels');
            } catch (err) {
                console.error('[RealtimeProvider] Failed to subscribe:', err);
                setIsConnected(false);
            }
        }, 1000); // Wait 1s after auth before subscribing

        return () => {
            clearTimeout(initTimeout);
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            setIsConnected(false);
        };
    }, [user?.$id]);

    return (
        <RealtimeContext.Provider value={{ isConnected, subscribe }}>
            {children}
        </RealtimeContext.Provider>
    );
}
