/**
 * Discord-like bitwise permission system
 * Each permission is a power of 2 for efficient bitwise operations
 * Permissions are stored as BigInt strings in the database
 */

// General Server Permissions
export const PERMISSIONS = {
    // Administrative
    ADMINISTRATOR: 1n << 0n,   // Full access bypass
    VIEW_CHANNELS: 1n << 1n,   // View text/voice channels
    MANAGE_CHANNELS: 1n << 2n,   // Create/edit/delete channels
    MANAGE_ROLES: 1n << 3n,   // Create/edit/delete roles
    MANAGE_SERVER: 1n << 4n,   // Edit server name, icon, region

    // Text Channel Permissions
    SEND_MESSAGES: 1n << 10n,
    EMBED_LINKS: 1n << 11n,
    ATTACH_FILES: 1n << 12n,
    ADD_REACTIONS: 1n << 13n,
    MENTION_EVERYONE: 1n << 14n,
    MANAGE_MESSAGES: 1n << 15n,  // Delete/pin others' messages
    READ_MESSAGE_HISTORY: 1n << 16n,
    SEND_TTS_MESSAGES: 1n << 17n,
    USE_EXTERNAL_EMOJIS: 1n << 18n,

    // Voice Channel Permissions
    CONNECT: 1n << 20n,
    SPEAK: 1n << 21n,
    VIDEO: 1n << 22n,
    MUTE_MEMBERS: 1n << 23n,
    DEAFEN_MEMBERS: 1n << 24n,
    MOVE_MEMBERS: 1n << 25n,
    USE_VAD: 1n << 26n,  // Voice Activity Detection
    PRIORITY_SPEAKER: 1n << 27n,
    STREAM: 1n << 28n,  // Screen share / Go Live

    // Member Management
    KICK_MEMBERS: 1n << 30n,
    BAN_MEMBERS: 1n << 31n,
    CREATE_INVITE: 1n << 32n,
    CHANGE_NICKNAME: 1n << 33n,
    MANAGE_NICKNAMES: 1n << 34n,
    MANAGE_EMOJIS: 1n << 35n,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Default permissions for @everyone role in new servers
 */
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

/**
 * All permissions combined (for administrators)
 */
export const ALL_PERMISSIONS: bigint = Object.values(PERMISSIONS).reduce((acc, perm) => acc | perm, 0n);

/**
 * Check if a permission is present in a bitfield
 * @param permissionBits - The permission bitfield (as bigint or string)
 * @param permission - The permission to check
 * @returns true if the permission is present
 */
export function hasPermission(permissionBits: bigint | string, permission: bigint): boolean {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;

    // Administrator bypasses all permission checks
    if ((bits & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
        return true;
    }

    return (bits & permission) === permission;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(permissionBits: bigint | string, permissions: bigint[]): boolean {
    return permissions.some(perm => hasPermission(permissionBits, perm));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(permissionBits: bigint | string, permissions: bigint[]): boolean {
    return permissions.every(perm => hasPermission(permissionBits, perm));
}

/**
 * Add a permission to a bitfield
 */
export function addPermission(permissionBits: bigint | string, permission: bigint): string {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    return (bits | permission).toString();
}

/**
 * Remove a permission from a bitfield
 */
export function removePermission(permissionBits: bigint | string, permission: bigint): string {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    return (bits & ~permission).toString();
}

/**
 * Toggle a permission in a bitfield
 */
export function togglePermission(permissionBits: bigint | string, permission: bigint): string {
    const bits = typeof permissionBits === 'string' ? BigInt(permissionBits || '0') : permissionBits;
    return (bits ^ permission).toString();
}

/**
 * Compute effective permissions from multiple roles
 * Permissions are combined with OR (union of all permissions)
 */
export function computePermissions(rolePermissions: string[]): string {
    let combined = 0n;

    for (const perms of rolePermissions) {
        combined |= BigInt(perms || '0');
    }

    return combined.toString();
}

/**
 * Get list of permission names from a bitfield
 */
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

/**
 * Create a permission bitfield from an array of permission names
 */
export function createPermissionBits(permissions: PermissionKey[]): string {
    let bits = 0n;

    for (const name of permissions) {
        bits |= PERMISSIONS[name];
    }

    return bits.toString();
}
