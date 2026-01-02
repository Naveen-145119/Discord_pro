import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Server } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useFriends } from '@/hooks/useFriends';

import './QuickSwitcher.css';

/**
 * QuickSwitcher - Global command palette (Ctrl/Cmd + K)
 * Features:
 * - Fuzzy search servers, DMs
 * - Keyboard navigation
 * - Quick navigation on selection
 */
export function QuickSwitcher() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { servers } = useServerStore();
    const { friends } = useFriends();

    // Global keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    const handleSelect = useCallback((route: string) => {
        navigate(route);
        setOpen(false);
    }, [navigate]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[400]"
                        onClick={() => setOpen(false)}
                    />

                    {/* Command Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15 }}
                        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[640px] z-[401]"
                    >
                        <Command
                            className="quick-switcher-root"
                            loop
                        >
                            <div className="quick-switcher-header">
                                <Command.Input
                                    placeholder="Where would you like to go?"
                                    className="quick-switcher-input"
                                    autoFocus
                                />
                            </div>

                            <Command.List className="quick-switcher-list">
                                <Command.Empty className="quick-switcher-empty">
                                    No results found.
                                </Command.Empty>

                                {/* DMs Section */}
                                {friends.length > 0 && (
                                    <Command.Group heading="Direct Messages" className="quick-switcher-group">
                                        {friends.map((friend) => (
                                            <Command.Item
                                                key={friend.$id}
                                                value={`dm ${friend.displayName} ${friend.username}`}
                                                onSelect={() => handleSelect(`/dm/${friend.$id}`)}
                                                className="quick-switcher-item"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-discord-primary overflow-hidden flex items-center justify-center">
                                                    {friend.avatarUrl ? (
                                                        <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <MessageCircle size={16} className="text-white" />
                                                    )}
                                                </div>
                                                <span className="flex-1">{friend.displayName}</span>
                                                <span className="text-text-muted text-sm">@{friend.username}</span>
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}

                                {/* Servers Section */}
                                {servers.length > 0 && (
                                    <Command.Group heading="Servers" className="quick-switcher-group">
                                        {servers.map((server) => (
                                            <Command.Item
                                                key={server.$id}
                                                value={`server ${server.name}`}
                                                onSelect={() => handleSelect(`/servers/${server.$id}`)}
                                                className="quick-switcher-item"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-background-tertiary overflow-hidden flex items-center justify-center">
                                                    {server.iconUrl ? (
                                                        <img src={server.iconUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Server size={16} className="text-text-muted" />
                                                    )}
                                                </div>
                                                <span className="flex-1">{server.name}</span>
                                                <span className="text-text-muted text-sm">Server</span>
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}
                            </Command.List>

                            <div className="quick-switcher-footer">
                                <span className="text-text-muted text-xs">
                                    <kbd className="px-1.5 py-0.5 rounded bg-background-tertiary text-[10px] mr-1">↑↓</kbd>
                                    to navigate
                                </span>
                                <span className="text-text-muted text-xs">
                                    <kbd className="px-1.5 py-0.5 rounded bg-background-tertiary text-[10px] mr-1">↵</kbd>
                                    to select
                                </span>
                                <span className="text-text-muted text-xs">
                                    <kbd className="px-1.5 py-0.5 rounded bg-background-tertiary text-[10px] mr-1">esc</kbd>
                                    to close
                                </span>
                            </div>
                        </Command>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

