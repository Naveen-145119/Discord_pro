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
