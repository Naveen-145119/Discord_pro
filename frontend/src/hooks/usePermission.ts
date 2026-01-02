import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import {
    PERMISSIONS,
    ALL_PERMISSIONS,
    computeMemberBasePermissions,
    computeChannelPermissions,
} from '@/lib/permissions';
import type { PermissionKey } from '@/lib/permissions';
import type { Channel } from '@/types';

interface UsePermissionReturn {
    /** The computed permission bits as bigint */
    permissions: bigint;
    /** Check if user has a specific permission */
    can: (permission: bigint) => boolean;
    /** Check if user has any of the specified permissions */
    canAny: (permissions: bigint[]) => boolean;
    /** Check if user has all specified permissions */
    canAll: (permissions: bigint[]) => boolean;
    /** Check if user is the server owner */
    isOwner: boolean;
    /** Check if user is an administrator */
    isAdmin: boolean;
    /** Whether the hook is still loading data */
    isLoading: boolean;
}

/**
 * Hook to compute and check user permissions for a server/channel.
 * 
 * @param serverId - The server ID to check permissions for
 * @param channelId - Optional channel ID for channel-specific overwrites
 * @returns Permission checking utilities
 * 
 * @example
 * ```tsx
 * const { can, isOwner } = usePermission(serverId, channelId);
 * 
 * if (can(PERMISSIONS.MANAGE_CHANNELS)) {
 *   // Show settings button
 * }
 * ```
 */
export function usePermission(serverId?: string, channelId?: string): UsePermissionReturn {
    const { user } = useAuthStore();
    const { currentServer, members, channels, roles, isLoading } = useServerStore();

    const result = useMemo(() => {
        // Default return for missing data
        const defaultReturn: UsePermissionReturn = {
            permissions: 0n,
            can: () => false,
            canAny: () => false,
            canAll: () => false,
            isOwner: false,
            isAdmin: false,
            isLoading: true,
        };

        if (!user?.$id || !serverId || !currentServer) {
            return defaultReturn;
        }

        // Verify we're looking at the correct server
        if (currentServer.$id !== serverId) {
            return defaultReturn;
        }

        // Find the current user's member record
        const member = members.find(m => m.userId === user.$id && m.serverId === serverId);
        if (!member) {
            return defaultReturn;
        }

        // Check if user is server owner
        const isOwner = currentServer.ownerId === user.$id;

        // Compute base permissions from roles
        let permissions = computeMemberBasePermissions(member, currentServer, roles);

        // If a channel is specified, apply channel overwrites
        if (channelId) {
            const channel = channels.find(c => c.$id === channelId) as Channel | undefined;
            if (channel?.permissionOverwrites) {
                const memberRoleIds: string[] = typeof member.roleIds === 'string'
                    ? JSON.parse(member.roleIds || '[]')
                    : member.roleIds || [];

                permissions = computeChannelPermissions(
                    permissions,
                    channel.permissionOverwrites,
                    member,
                    memberRoleIds
                );
            }
        }

        // Check if user has admin (after all computation)
        const isAdmin = (permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR
            || permissions === ALL_PERMISSIONS;

        // Helper functions
        const can = (permission: bigint): boolean => {
            if (isOwner || isAdmin) return true;
            return (permissions & permission) === permission;
        };

        const canAny = (perms: bigint[]): boolean => {
            if (isOwner || isAdmin) return true;
            return perms.some(p => (permissions & p) === p);
        };

        const canAll = (perms: bigint[]): boolean => {
            if (isOwner || isAdmin) return true;
            return perms.every(p => (permissions & p) === p);
        };

        return {
            permissions,
            can,
            canAny,
            canAll,
            isOwner,
            isAdmin,
            isLoading: false,
        };
    }, [user?.$id, serverId, channelId, currentServer, members, channels, roles, isLoading]);

    return result;
}

// Re-export PERMISSIONS for convenience
export { PERMISSIONS } from '@/lib/permissions';
export type { PermissionKey };
