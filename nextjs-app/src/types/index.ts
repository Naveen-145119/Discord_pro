// Base document interface for Appwrite documents
interface BaseDocument {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
}

// User status types
export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

// User model
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

// Friend system
export interface Friend extends BaseDocument {
    userId1: string;
    userId2: string;
    friend?: User;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest extends BaseDocument {
    senderId: string;
    receiverId: string;
    status: FriendRequestStatus;
    sender?: User;
    receiver?: User;
}

// Server (Guild) model
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

// Server member with role
export interface ServerMember {
    $id: string;
    $createdAt: string;
    serverId: string;
    userId: string;
    nickname: string | null;
    roleIds: string[];
    joinedAt: string;
    permissionBits: string;
    user?: User;
}

// Channel types
export type ChannelType =
    | 'text'
    | 'voice'
    | 'category'
    | 'forum'
    | 'stage'
    | 'dm'
    | 'group_dm';

export type OverwriteType = 'role' | 'member';

export interface ChannelOverwrite {
    id: string;
    type: OverwriteType;
    allow: string;
    deny: string;
}

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
    participantIds?: string[];
    lastMessageAt?: string | null;
    permissionOverwrites?: ChannelOverwrite[];
}

// Message types
export type MessageType = 'default' | 'reply' | 'system' | 'join' | 'leave' | 'call';

export interface CallLogMetadata {
    callType: 'voice' | 'video';
    callStatus: 'started' | 'ended' | 'missed' | 'declined';
    duration?: number;
    callerId: string;
    receiverId: string;
}

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
    metadata?: string;
    embeds: Embed[];
    reactions: Reaction[];
    mentionRoleIds: string[];
    mentionUserIds: string[];
    mentionEveryone: boolean;
    isPinned: boolean;
    isEdited: boolean;
    editedAt: string | null;
    author?: User;
    replyTo?: Message;
}

// Role model
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

// Voice state
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
    user?: User;
}

// Invite model
export interface Invite {
    $id: string;
    $createdAt: string;
    serverId: string;
    channelId: string;
    creatorId: string;
    maxUses: number | null;
    maxAge: number | null;
    uses: number;
    expiresAt: string | null;
    server?: Server;
    channel?: Channel;
    creator?: User;
}

// Typing state
export interface TypingState {
    $id: string;
    $createdAt: string;
    channelId: string;
    userId: string;
    username: string;
    expiresAt: string;
}

// DM Channel
export interface DMChannel extends BaseDocument {
    type: 'dm' | 'group_dm';
    participantIds: string[];
    name: string | null;
    iconUrl: string | null;
    ownerId: string | null;
    lastMessageAt: string | null;
    participants?: User[];
    lastMessage?: Message;
}

// API response types
export interface PaginatedResponse<T> {
    documents: T[];
    total: number;
}

export interface ApiError {
    message: string;
    code: number;
    type: string;
}

// Realtime event types
export type RealtimeEventType = 'create' | 'update' | 'delete';

export interface RealtimeEvent<T> {
    events: string[];
    payload: T;
    channels: string[];
    timestamp: string;
}

// Member roles for RBAC (per blueprint)
export type MemberRole = 'ADMIN' | 'MODERATOR' | 'GUEST';
