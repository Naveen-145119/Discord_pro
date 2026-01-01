/**
 * TypeScript type definitions for Discord clone
 * Matching Appwrite database schema
 */

// ============================================
// Base Types
// ============================================

/** Base Appwrite document properties */
interface BaseDocument {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
}

// ============================================
// User Types
// ============================================

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User extends BaseDocument {
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    status: UserStatus;
    customStatus: string | null;
}

export interface UserSettings {
    theme: 'dark' | 'light';
    notifications: boolean;
    dmPrivacy: 'everyone' | 'friends' | 'none';
}

// ============================================
// Server Types
// ============================================

export interface Server extends BaseDocument {
    name: string;
    description: string | null;
    iconUrl: string | null;
    bannerUrl: string | null;
    ownerId: string;
    isPublic: boolean;
    verificationLevel: 0 | 1 | 2 | 3 | 4;
    memberCount: number;
    defaultChannelId: string | null;
    systemChannelId: string | null;
}

export interface ServerMember {
    $id: string;
    $createdAt: string;
    serverId: string;
    userId: string;
    nickname: string | null;
    roleIds: string[];
    joinedAt: string;
    permissionBits: string;

    // Joined user data (populated on fetch)
    user?: User;
}

// ============================================
// Channel Types
// ============================================

export type ChannelType =
    | 'text'
    | 'voice'
    | 'category'
    | 'forum'
    | 'stage'
    | 'dm'
    | 'group_dm';

export interface Channel extends BaseDocument {
    serverId: string | null;
    type: ChannelType;
    name: string;
    topic: string | null;
    position: number;
    parentId: string | null;
    isNsfw: boolean;
    slowmodeSeconds: number;
    userLimit: number | null;
    bitrate: number | null;

    // For DM channels
    participantIds?: string[];
    lastMessageAt?: string | null;
}

// ============================================
// Message Types
// ============================================

export type MessageType = 'default' | 'reply' | 'system' | 'join' | 'leave';

export interface Attachment {
    id: string;
    url: string;
    filename: string;
    contentType: string;
    size: number;
    width?: number;
    height?: number;
}

export interface Embed {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    thumbnail?: string;
    image?: string;
    author?: {
        name: string;
        iconUrl?: string;
    };
    footer?: {
        text: string;
        iconUrl?: string;
    };
}

export interface Reaction {
    emoji: string;
    count: number;
    userIds: string[];
    me?: boolean;
}

export interface Message extends BaseDocument {
    channelId: string;
    authorId: string;
    content: string;
    type: MessageType;
    replyToId: string | null;
    attachments: Attachment[];
    metadata?: string; // Contains nested JSON for embeds, reactions, mentionRoleIds

    // Derived from metadata
    embeds: Embed[];
    reactions: Reaction[];
    mentionRoleIds: string[];

    mentionUserIds: string[];
    mentionEveryone: boolean;
    isPinned: boolean;
    isEdited: boolean;
    editedAt: string | null;

    // Populated on fetch
    author?: User;
    replyTo?: Message;
}

// ============================================
// Role Types
// ============================================

export interface Role extends BaseDocument {
    serverId: string;
    name: string;
    color: string;
    position: number;
    permissions: string;
    isHoisted: boolean;
    isMentionable: boolean;
    iconUrl?: string | null;
}

// ============================================
// Voice Types
// ============================================

export interface VoiceState {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    serverId: string;
    channelId: string;
    userId: string;
    isMuted: boolean;
    isDeafened: boolean;
    isSelfMuted: boolean;
    isSelfDeafened: boolean;
    isStreaming: boolean;
    isVideoOn: boolean;
    sessionId: string;

    // Populated
    user?: User;
}

// ============================================
// Invite Types
// ============================================

export interface Invite {
    $id: string;  // This is the invite code
    $createdAt: string;
    serverId: string;
    channelId: string;
    creatorId: string;
    maxUses: number | null;
    maxAge: number | null;
    uses: number;
    expiresAt: string | null;

    // Populated
    server?: Server;
    channel?: Channel;
    creator?: User;
}

// ============================================
// Typing State Types
// ============================================

export interface TypingState {
    $id: string;
    $createdAt: string;
    channelId: string;
    userId: string;
    username: string;
    expiresAt: string;
}

// ============================================
// DM Channel Types
// ============================================

export interface DMChannel extends BaseDocument {
    type: 'dm' | 'group_dm';
    participantIds: string[];
    name: string | null;  // Only for group DMs
    iconUrl: string | null;  // Only for group DMs
    ownerId: string | null;  // Only for group DMs
    lastMessageAt: string | null;

    // Populated
    participants?: User[];
    lastMessage?: Message;
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
    documents: T[];
    total: number;
}

export interface ApiError {
    message: string;
    code: number;
    type: string;
}

// ============================================
// Realtime Event Types
// ============================================

export type RealtimeEventType =
    | 'create'
    | 'update'
    | 'delete';

export interface RealtimeEvent<T> {
    events: string[];
    payload: T;
    channels: string[];
    timestamp: string;
}
