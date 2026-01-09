import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

// Configuration
const OFFLINE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const LOGOUT_TIMEOUT_MS = 60 * 60 * 1000;  // 1 hour

// Activity events to track
const ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
] as const;

/**
 * usePresence - Manages user presence/status automatically
 * 
 * - Sets status to 'offline' after 15 min of inactivity
 * - Auto-logs out user after 1 hour of inactivity
 * - Returns to 'online' when user becomes active
 * - Handles tab visibility changes
 */
export function usePresence() {
    const { user, isAuthenticated, updateStatus, logout } = useAuthStore();

    const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isOfflineRef = useRef(false);
    const lastActivityRef = useRef(Date.now());

    // Clear all timers
    const clearTimers = useCallback(() => {
        if (offlineTimerRef.current) {
            clearTimeout(offlineTimerRef.current);
            offlineTimerRef.current = null;
        }
        if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current);
            logoutTimerRef.current = null;
        }
    }, []);

    // Set user offline
    const setOffline = useCallback(async () => {
        if (!isAuthenticated || isOfflineRef.current) return;

        console.log('[Presence] User inactive for 15 min - setting offline');
        isOfflineRef.current = true;
        await updateStatus('offline');
    }, [isAuthenticated, updateStatus]);

    // Auto-logout due to extended inactivity
    const autoLogout = useCallback(async () => {
        if (!isAuthenticated) return;

        console.log('[Presence] User inactive for 1 hour - logging out');
        await logout();
    }, [isAuthenticated, logout]);

    // Set user online (when they become active)
    const setOnline = useCallback(async () => {
        if (!isAuthenticated || !isOfflineRef.current) return;

        console.log('[Presence] User active - setting online');
        isOfflineRef.current = false;
        await updateStatus('online');
    }, [isAuthenticated, updateStatus]);

    // Reset timers on activity
    const resetTimers = useCallback(() => {
        lastActivityRef.current = Date.now();

        // If currently offline, go back online
        if (isOfflineRef.current) {
            setOnline();
        }

        // Clear existing timers
        clearTimers();

        // Set new offline timer (15 min)
        offlineTimerRef.current = setTimeout(() => {
            setOffline();
        }, OFFLINE_TIMEOUT_MS);

        // Set new logout timer (1 hour)
        logoutTimerRef.current = setTimeout(() => {
            autoLogout();
        }, LOGOUT_TIMEOUT_MS);
    }, [clearTimers, setOffline, setOnline, autoLogout]);

    // Handle visibility change (tab hidden/visible)
    const handleVisibilityChange = useCallback(() => {
        if (document.hidden) {
            // Tab is hidden - could optionally set offline immediately
            // For now, just let the timers run
            console.log('[Presence] Tab hidden');
        } else {
            // Tab is visible again - reset timers and go online
            console.log('[Presence] Tab visible');
            resetTimers();
        }
    }, [resetTimers]);

    // Handle page unload (tab close)
    const handleBeforeUnload = useCallback(() => {
        // Use navigator.sendBeacon for reliable offline update on tab close
        if (user) {
            // Note: sendBeacon can't be used with Appwrite SDK directly
            // The status will update when user returns or session expires
            console.log('[Presence] Page unloading');
        }
    }, [user]);

    // Main effect - set up event listeners
    useEffect(() => {
        if (!isAuthenticated) return;

        // Start timers
        resetTimers();

        // Add activity listeners
        ACTIVITY_EVENTS.forEach(event => {
            document.addEventListener(event, resetTimers, { passive: true });
        });

        // Add visibility listener
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Add unload listener
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup
        return () => {
            clearTimers();

            ACTIVITY_EVENTS.forEach(event => {
                document.removeEventListener(event, resetTimers);
            });

            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isAuthenticated, resetTimers, handleVisibilityChange, handleBeforeUnload, clearTimers]);

    // Set online when user first logs in
    useEffect(() => {
        if (isAuthenticated && user?.status !== 'online') {
            updateStatus('online');
        }
    }, [isAuthenticated, user?.status, updateStatus]);

    return {
        isOffline: isOfflineRef.current,
        lastActivity: lastActivityRef.current,
    };
}
