'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const LOGOUT_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Auto-presence hook (Blueprint auto-presence feature)
// - Sets user offline after 15 minutes of inactivity
// - Auto-logout after 1 hour of inactivity
export function usePresence() {
    const { user, updateStatus, logout } = useAuthStore();
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isIdleRef = useRef(false);

    const resetTimers = useCallback(() => {
        // Clear existing timers
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current);
        }

        // If user was idle, set them back online
        if (isIdleRef.current && user) {
            isIdleRef.current = false;
            updateStatus('online');
        }

        // Set idle timer (15 min)
        idleTimerRef.current = setTimeout(() => {
            if (user) {
                isIdleRef.current = true;
                updateStatus('offline');
            }
        }, IDLE_TIMEOUT);

        // Set logout timer (1 hour)
        logoutTimerRef.current = setTimeout(() => {
            if (user) {
                logout();
            }
        }, LOGOUT_TIMEOUT);
    }, [user, updateStatus, logout]);

    useEffect(() => {
        if (!user) return;

        // Activity events to track
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        // Reset timers on activity
        events.forEach((event) => {
            window.addEventListener(event, resetTimers, { passive: true });
        });

        // Handle visibility change
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab hidden - start idle timer immediately
                if (idleTimerRef.current) {
                    clearTimeout(idleTimerRef.current);
                }
                idleTimerRef.current = setTimeout(() => {
                    if (user) {
                        isIdleRef.current = true;
                        updateStatus('offline');
                    }
                }, 5000); // 5 seconds when tab hidden
            } else {
                // Tab visible - reset to online
                resetTimers();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Initialize timers
        resetTimers();

        // Cleanup
        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, resetTimers);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
            if (logoutTimerRef.current) {
                clearTimeout(logoutTimerRef.current);
            }
        };
    }, [user, resetTimers, updateStatus]);

    return { isIdle: isIdleRef.current };
}
