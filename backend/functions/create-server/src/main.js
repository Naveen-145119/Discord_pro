import { Client, Databases, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
        error('Missing required environment variables');
        return res.json({ success: false, error: 'Server configuration error' }, 500);
    }

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = process.env.DATABASE_ID || 'discord_db';

    const DEFAULT_PERMISSIONS = (
        (1n << 1n) |
        (1n << 10n) |
        (1n << 16n) |
        (1n << 13n) |
        (1n << 20n) |
        (1n << 21n) |
        (1n << 28n) |
        (1n << 32n)
    ).toString();

    const OWNER_PERMISSIONS = (1n << 0n).toString();

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { name, ownerId, description, isPublic } = body;

        if (!name || !ownerId) {
            return res.json({
                success: false,
                error: 'Missing required fields: name, ownerId'
            }, 400);
        }

        if (typeof name !== 'string' || typeof ownerId !== 'string') {
            return res.json({ success: false, error: 'Invalid field types' }, 400);
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 100) {
            return res.json({
                success: false,
                error: 'Server name must be between 2 and 100 characters'
            }, 400);
        }

        const server = await databases.createDocument(
            DATABASE_ID,
            'servers',
            ID.unique(),
            {
                name: trimmedName,
                description: description && typeof description === 'string' ? description.trim() : null,
                iconUrl: null,
                bannerUrl: null,
                ownerId,
                isPublic: isPublic === true,
                verificationLevel: 0,
                memberCount: 1,
                defaultChannelId: null
            }
        );

        log(`Server created: ${server.$id} by ${ownerId}`);

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

        await databases.updateDocument(
            DATABASE_ID,
            'servers',
            server.$id,
            { defaultChannelId: generalChannel.$id }
        );

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
                permissionBits: OWNER_PERMISSIONS
            }
        );

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
        return res.json({ success: false, error: 'Failed to create server' }, 500);
    }
};
