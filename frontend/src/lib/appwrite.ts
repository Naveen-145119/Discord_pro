import { Client, Account, Databases, Storage, Functions } from 'appwrite';

const client = new Client();

client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export { client };

export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'discord_db';

export const COLLECTIONS = {
    USERS: 'users',
    SERVERS: 'servers',
    SERVER_MEMBERS: 'server_members',
    CHANNELS: 'channels',
    MESSAGES: 'messages',
    ROLES: 'roles',
    INVITES: 'invites',
    VOICE_STATES: 'voice_states',
    TYPING_STATES: 'typing_states',
    DM_CHANNELS: 'dm_channels',
    WEBRTC_SIGNALS: 'webrtc_signals',
    FRIENDS: 'friends',
    FRIEND_REQUESTS: 'friend_requests',
    ACTIVE_CALLS: 'active_calls',
} as const;

export const BUCKETS = {
    AVATARS: 'avatars',
    ATTACHMENTS: 'attachments',
    BANNERS: 'banners',
    EMOJIS: 'emojis',
} as const;

export type CollectionId = typeof COLLECTIONS[keyof typeof COLLECTIONS];
export type BucketId = typeof BUCKETS[keyof typeof BUCKETS];
