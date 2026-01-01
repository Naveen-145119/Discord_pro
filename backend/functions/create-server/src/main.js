/**
 * Create Server - Appwrite Function
 * Creates a new server with default channel and @everyone role
 */
import { Client, Databases, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = process.env.DATABASE_ID || 'discord_db';

    // Default permissions for @everyone role
    const DEFAULT_PERMISSIONS = (
        (1n << 1n) |  // VIEW_CHANNELS
        (1n << 10n) | // SEND_MESSAGES
        (1n << 16n) | // READ_MESSAGE_HISTORY
        (1n << 13n) | // ADD_REACTIONS
        (1n << 20n) | // CONNECT
        (1n << 21n) | // SPEAK
        (1n << 28n) | // STREAM
        (1n << 32n)   // CREATE_INVITE
    ).toString();

    try {
        const { name, ownerId, description, isPublic } = JSON.parse(req.body || '{}');

        // Validate required fields
        if (!name || !ownerId) {
            return res.json({
                success: false,
                error: 'Missing required fields: name, ownerId'
            }, 400);
        }

        // Validate name length
        if (name.length < 2 || name.length > 100) {
            return res.json({
                success: false,
                error: 'Server name must be between 2 and 100 characters'
            }, 400);
        }

        // Create server
        const server = await databases.createDocument(
            DATABASE_ID,
            'servers',
            ID.unique(),
            {
                name,
                description: description || null,
                iconUrl: null,
                bannerUrl: null,
                ownerId,
                isPublic: isPublic || false,
                verificationLevel: 0,
                memberCount: 1,
                defaultChannelId: null
            }
        );

        log(`Server created: ${server.$id} by ${ownerId}`);

        // Create @everyone role
        await databases.createDocument(
            DATABASE_ID,
            'roles',
            ID.unique(),
            {
                serverId: server.$id,
                name: '@everyone',
                color: '#99AAB5',
                position: 0,
                permissions: DEFAULT_PERMISSIONS,
                isHoisted: false,
                isMentionable: false
            }
        );

        // Create default #general text channel
        const generalChannel = await databases.createDocument(
            DATABASE_ID,
            'channels',
            ID.unique(),
            {
                serverId: server.$id,
                type: 'text',
                name: 'general',
                topic: 'Welcome to the server!',
                position: 0,
                parentId: null,
                isNsfw: false,
                slowmodeSeconds: 0,
                userLimit: null
            }
        );

        // Update server with default channel
        await databases.updateDocument(
            DATABASE_ID,
            'servers',
            server.$id,
            { defaultChannelId: generalChannel.$id }
        );

        // Add owner as first member
        await databases.createDocument(
            DATABASE_ID,
            'server_members',
            ID.unique(),
            {
                serverId: server.$id,
                userId: ownerId,
                nickname: null,
                roleIds: JSON.stringify([]),
                joinedAt: new Date().toISOString(),
                permissionBits: DEFAULT_PERMISSIONS
            }
        );

        // Create system message
        await databases.createDocument(
            DATABASE_ID,
            'messages',
            ID.unique(),
            {
                channelId: generalChannel.$id,
                authorId: ownerId,
                content: 'Welcome to the server! 🎉',
                type: 'system',
                replyToId: null,
                attachments: JSON.stringify([]),
                embeds: JSON.stringify([]),
                reactions: JSON.stringify([]),
                mentionUserIds: JSON.stringify([]),
                mentionRoleIds: JSON.stringify([]),
                mentionEveryone: false,
                isPinned: false,
                isEdited: false,
                editedAt: null
            }
        );

        return res.json({
            success: true,
            data: {
                ...server,
                defaultChannelId: generalChannel.$id
            }
        });
    } catch (err) {
        error(`Error creating server: ${err.message}`);
        return res.json({
            success: false,
            error: 'Failed to create server'
        }, 500);
    }
};
