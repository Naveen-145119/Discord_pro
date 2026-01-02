import { Client, Databases, ID, Query } from 'node-appwrite';

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

    const MANAGE_CHANNELS = 1n << 2n;
    const ADMINISTRATOR = 1n << 0n;

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { serverId, userId, name, type, parentId, topic } = body;

        if (!serverId || !userId || !name || !type) {
            return res.json({
                success: false,
                error: 'Missing required fields: serverId, userId, name, type'
            }, 400);
        }

        if (typeof serverId !== 'string' || typeof userId !== 'string' ||
            typeof name !== 'string' || typeof type !== 'string') {
            return res.json({ success: false, error: 'Invalid field types' }, 400);
        }

        const validTypes = ['text', 'voice', 'category', 'forum', 'stage'];
        if (!validTypes.includes(type)) {
            return res.json({
                success: false,
                error: `Invalid channel type. Must be one of: ${validTypes.join(', ')}`
            }, 400);
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 1 || trimmedName.length > 100) {
            return res.json({
                success: false,
                error: 'Channel name must be between 1 and 100 characters'
            }, 400);
        }

        if (parentId !== undefined && parentId !== null) {
            if (typeof parentId !== 'string') {
                return res.json({ success: false, error: 'Invalid parentId type' }, 400);
            }
            try {
                const parent = await databases.getDocument(DATABASE_ID, 'channels', parentId);
                if (parent.type !== 'category') {
                    return res.json({ success: false, error: 'Parent must be a category' }, 400);
                }
                if (parent.serverId !== serverId) {
                    return res.json({ success: false, error: 'Parent category not in same server' }, 400);
                }
            } catch {
                return res.json({ success: false, error: 'Parent category not found' }, 404);
            }
        }

        let server;
        try {
            server = await databases.getDocument(DATABASE_ID, 'servers', serverId);
        } catch {
            return res.json({ success: false, error: 'Server not found' }, 404);
        }

        const memberships = await databases.listDocuments(DATABASE_ID, 'server_members', [
            Query.equal('serverId', serverId),
            Query.equal('userId', userId),
            Query.limit(1)
        ]);

        if (memberships.documents.length === 0) {
            return res.json({
                success: false,
                error: 'You are not a member of this server'
            }, 403);
        }

        const member = memberships.documents[0];
        const permissions = BigInt(member.permissionBits || '0');

        const hasPermission = server.ownerId === userId ||
            (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
            (permissions & MANAGE_CHANNELS) === MANAGE_CHANNELS;

        if (!hasPermission) {
            return res.json({
                success: false,
                error: 'You do not have permission to create channels'
            }, 403);
        }

        const existingChannels = await databases.listDocuments(DATABASE_ID, 'channels', [
            Query.equal('serverId', serverId),
            Query.orderDesc('position'),
            Query.limit(1)
        ]);

        const basePosition = existingChannels.documents.length > 0
            ? existingChannels.documents[0].position + 1
            : 0;

        const channel = await databases.createDocument(
            DATABASE_ID,
            'channels',
            ID.unique(),
            {
                serverId,
                type,
                name: trimmedName.toLowerCase().replace(/\s+/g, '-'),
                topic: topic && typeof topic === 'string' ? topic.trim() : null,
                position: basePosition,
                parentId: parentId || null,
                isNsfw: false,
                slowmodeSeconds: 0,
                userLimit: type === 'voice' ? 99 : null
            }
        );

        log(`Channel created: ${channel.$id} in server ${serverId}`);

        return res.json({ success: true, data: channel });
    } catch (err) {
        error(`Error creating channel: ${err.message}`);
        return res.json({ success: false, error: 'Failed to create channel' }, 500);
    }
};
