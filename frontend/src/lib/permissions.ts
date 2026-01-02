export const PERMISSIONS = {
    ADMINISTRATOR: 1n << 0n,
    VIEW_CHANNELS: 1n << 1n,
    MANAGE_CHANNELS: 1n << 2n,
    MANAGE_ROLES: 1n << 3n,
    MANAGE_SERVER: 1n << 4n,

    SEND_MESSAGES: 1n << 10n,
    EMBED_LINKS: 1n << 11n,
    ATTACH_FILES: 1n << 12n,
    ADD_REACTIONS: 1n << 13n,
    MENTION_EVERYONE: 1n << 14n,
    MANAGE_MESSAGES: 1n << 15n,
    READ_MESSAGE_HISTORY: 1n << 16n,
    SEND_TTS_MESSAGES: 1n << 17n,
    USE_EXTERNAL_EMOJIS: 1n << 18n,

    CONNECT: 1n << 20n,
    SPEAK: 1n << 21n,
    VIDEO: 1n << 22n,
    MUTE_MEMBERS: 1n << 23n,
    DEAFEN_MEMBERS: 1n << 24n,
    MOVE_MEMBERS: 1n << 25n,
    USE_VAD: 1n << 26n,
    PRIORITY_SPEAKER: 1n << 27n,
    STREAM: 1n << 28n,

    KICK_MEMBERS: 1n << 30n,
    BAN_MEMBERS: 1n << 31n,
    CREATE_INVITE: 1n << 32n,
    CHANGE_NICKNAME: 1n << 33n,
    MANAGE_NICKNAMES: 1n << 34n,
    MANAGE_EMOJIS: 1n << 35n,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const DEFAULT_PERMISSIONS: bigint =
    PERMISSIONS.VIEW_CHANNELS |
    PERMISSIONS.SEND_MESSAGES |
    PERMISSIONS.READ_MESSAGE_HISTORY |
    PERMISSIONS.ADD_REACTIONS |
    PERMISSIONS.EMBED_LINKS |
    PERMISSIONS.ATTACH_FILES |
    PERMISSIONS.USE_EXTERNAL_EMOJIS |
    PERMISSIONS.CONNECT |
    PERMISSIONS.SPEAK |
    PERMISSIONS.VIDEO |
    PERMISSIONS.USE_VAD |
    PERMISSIONS.STREAM |
    PERMISSIONS.CREATE_INVITE |
    PERMISSIONS.CHANGE_NICKNAME;

export const ALL_PERMISSIONS: bigint = Object.values(PERMISSIONS).reduce((acc, perm) => acc | perm, 0n);

export function hasPermission(permissionBits: bigint | string, permission: bigint): boolean {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;

    if ((bits & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
        return true;
    }

    return (bits & permission) === permission;
}

export function hasAnyPermission(permissionBits: bigint | string, permissions: bigint[]): boolean {
    return permissions.some(perm => hasPermission(permissionBits, perm));
}

export function hasAllPermissions(permissionBits: bigint | string, permissions: bigint[]): boolean {
    return permissions.every(perm => hasPermission(permissionBits, perm));
}

export function addPermission(permissionBits: bigint | string, permission: bigint): string {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    return (bits | permission).toString();
}

export function removePermission(permissionBits: bigint | string, permission: bigint): string {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    return (bits & ~permission).toString();
}

export function togglePermission(permissionBits: bigint | string, permission: bigint): string {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    return (bits ^ permission).toString();
}

export function computePermissions(rolePermissions: string[]): string {
    let combined = 0n;

    for (const perms of rolePermissions) {
        combined |= BigInt(perms || '0');
    }

    return combined.toString();
}

export function getPermissionNames(permissionBits: bigint | string): PermissionKey[] {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    const names: PermissionKey[] = [];

    for (const [name, value] of Object.entries(PERMISSIONS)) {
        if ((bits & value) === value) {
            names.push(name as PermissionKey);
        }
    }

    return names;
}

export function createPermissionBits(permissions: PermissionKey[]): string {
    let bits = 0n;

    for (const name of permissions) {
        bits |= PERMISSIONS[name];
    }

    return bits.toString();
}

// --- Advanced Permission Computation ---

import type { Role, ServerMember, ChannelOverwrite, Server } from '@/types';

/**
 * Computes base permissions for a member from their roles.
 * Admin bypass: If any role has ADMINISTRATOR, returns ALL_PERMISSIONS.
 */
export function computeMemberBasePermissions(
    member: ServerMember,
    server: Server,
    roles: Role[]
): bigint {
    // Server owner has all permissions
    if (member.userId === server.ownerId) {
        return ALL_PERMISSIONS;
    }

    let permissions = 0n;

    // Get @everyone role (position 0)
    const everyoneRole = roles.find(r => r.name === '@everyone' && r.serverId === server.$id);
    if (everyoneRole) {
        permissions |= BigInt(everyoneRole.permissions || '0');
    }

    // Parse member's roleIds (stored as JSON string)
    const memberRoleIds: string[] = typeof member.roleIds === 'string'
        ? JSON.parse(member.roleIds || '[]')
        : member.roleIds || [];

    // Combine permissions from all member roles
    for (const roleId of memberRoleIds) {
        const role = roles.find(r => r.$id === roleId);
        if (role) {
            permissions |= BigInt(role.permissions || '0');
        }
    }

    // Administrator bypass
    if ((permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
        return ALL_PERMISSIONS;
    }

    return permissions;
}

/**
 * Applies permission overwrites (allow/deny) to base permissions.
 */
export function applyOverwritePermissions(
    basePermissions: bigint,
    allow: string,
    deny: string
): bigint {
    let permissions = basePermissions;

    // First apply deny (remove permissions)
    permissions &= ~BigInt(deny || '0');

    // Then apply allow (add permissions)
    permissions |= BigInt(allow || '0');

    return permissions;
}

/**
 * Computes final channel permissions for a member.
 * Order: Base permissions -> @everyone overwrites -> Role overwrites -> Member overwrites
 */
export function computeChannelPermissions(
    basePermissions: bigint,
    overwrites: ChannelOverwrite[] | undefined,
    member: ServerMember,
    memberRoleIds: string[]
): bigint {
    // If user has admin, they bypass all overwrites
    if ((basePermissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
        return ALL_PERMISSIONS;
    }

    if (!overwrites || overwrites.length === 0) {
        return basePermissions;
    }

    let permissions = basePermissions;

    // 1. Apply @everyone overwrites (role with same ID as server)
    const everyoneOverwrite = overwrites.find(o => o.type === 'role' && o.id === member.serverId);
    if (everyoneOverwrite) {
        permissions = applyOverwritePermissions(permissions, everyoneOverwrite.allow, everyoneOverwrite.deny);
    }

    // 2. Apply role-based overwrites
    let allow = 0n;
    let deny = 0n;
    for (const roleId of memberRoleIds) {
        const overwrite = overwrites.find(o => o.type === 'role' && o.id === roleId);
        if (overwrite) {
            allow |= BigInt(overwrite.allow || '0');
            deny |= BigInt(overwrite.deny || '0');
        }
    }
    permissions &= ~deny;
    permissions |= allow;

    // 3. Apply member-specific overwrites (highest priority)
    const memberOverwrite = overwrites.find(o => o.type === 'member' && o.id === member.userId);
    if (memberOverwrite) {
        permissions = applyOverwritePermissions(permissions, memberOverwrite.allow, memberOverwrite.deny);
    }

    return permissions;
}
