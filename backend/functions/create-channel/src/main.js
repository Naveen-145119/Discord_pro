/**
 * Create Channel - Appwrite Function
 * Creates a new channel in a server
 */
import { Client, Databases, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = process.env.DATABASE_ID || 'discord_db';

    // Permission flags
    const MANAGE_CHANNELS = 1n << 2n;
    const ADMINISTRATOR = 1n << 0n;

    try {
        const { serverId, userId, name, type, parentId, topic } = JSON.parse(req.body || '{}');

        // Validate required fields
        if (!serverId || !userId || !name || !type) {
            return res.json({
                success: false,
                error: 'Missing required fields: serverId, userId, name, type'
            }, 400);
        }

        // Validate channel type
        const validTypes = ['text', 'voice', 'category', 'forum', 'stage'];
        if (!validTypes.includes(type)) {
            return res.json({
                success: false,
                error: `Invalid channel type. Must be one of: ${validTypes.join(', ')}`
            }, 400);
        }

        // Validate name
        if (name.length < 1 || name.length > 100) {
            return res.json({
                success: false,
                error: 'Channel name must be between 1 and 100 characters'
            }, 400);
        }

        // Check server exists
        let server;
        try {
            server = await databases.getDocument(DATABASE_ID, 'servers', serverId);
        } catch {
            return res.json({
                success: false,
                error: 'Server not found'
            }, 404);
        }

        // Check user is member and has permission
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

        // Check for MANAGE_CHANNELS or ADMINISTRATOR permission (or is owner)
        const hasPermission = server.ownerId === userId ||
            (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
            (permissions & MANAGE_CHANNELS) === MANAGE_CHANNELS;

        if (!hasPermission) {
            return res.json({
                success: false,
                error: 'You do not have permission to create channels'
            }, 403);
        }

        // Get highest position for ordering
        const existingChannels = await databases.listDocuments(DATABASE_ID, 'channels', [
            Query.equal('serverId', serverId),
            Query.orderDesc('position'),
            Query.limit(1)
        ]);

        const nextPosition = existingChannels.documents.length > 0
            ? existingChannels.documents[0].position + 1
            : 0;

        // Create channel
        const channel = await databases.createDocument(
            DATABASE_ID,
            'channels',
            ID.unique(),
            {
                serverId,
                type,
                name: name.toLowerCase().replace(/\s+/g, '-'), // Discord-style naming
                topic: topic || null,
                position: nextPosition,
                parentId: parentId || null,
                isNsfw: false,
                slowmodeSeconds: 0,
                userLimit: type === 'voice' ? 99 : null
            }
        );

        log(`Channel created: ${channel.$id} in server ${serverId}`);

        return res.json({
            success: true,
            data: channel
        });
    } catch (err) {
        error(`Error creating channel: ${err.message}`);
        return res.json({
            success: false,
            error: 'Failed to create channel'
        }, 500);
    }
};
