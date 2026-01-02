import { Client, Databases, Query } from 'node-appwrite';

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

    // Permission constants
    const MANAGE_CHANNELS = 1n << 2n;
    const ADMINISTRATOR = 1n << 0n;

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { serverId, userId, channels } = body;

        // Validate required fields
        if (!serverId || !userId || !channels) {
            return res.json({
                success: false,
                error: 'Missing required fields: serverId, userId, channels'
            }, 400);
        }

        if (!Array.isArray(channels) || channels.length === 0) {
            return res.json({
                success: false,
                error: 'channels must be a non-empty array'
            }, 400);
        }

        // Validate channel items structure
        for (const channel of channels) {
            if (!channel.id || typeof channel.position !== 'number') {
                return res.json({
                    success: false,
                    error: 'Each channel must have id and position'
                }, 400);
            }
            if (channel.parentId !== undefined && channel.parentId !== null && typeof channel.parentId !== 'string') {
                return res.json({
                    success: false,
                    error: 'parentId must be a string or null'
                }, 400);
            }
        }

        // Verify server exists
        let server;
        try {
            server = await databases.getDocument(DATABASE_ID, 'servers', serverId);
        } catch {
            return res.json({ success: false, error: 'Server not found' }, 404);
        }

        // Verify user is a member and has permissions
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
                error: 'You do not have permission to reorder channels'
            }, 403);
        }

        // Verify all channels belong to this server
        const channelIds = channels.map(c => c.id);
        const existingChannels = await databases.listDocuments(DATABASE_ID, 'channels', [
            Query.equal('$id', channelIds),
            Query.limit(channelIds.length)
        ]);

        const existingChannelMap = new Map(existingChannels.documents.map(c => [c.$id, c]));

        for (const channelId of channelIds) {
            const existing = existingChannelMap.get(channelId);
            if (!existing) {
                return res.json({
                    success: false,
                    error: `Channel ${channelId} not found`
                }, 404);
            }
            if (existing.serverId !== serverId) {
                return res.json({
                    success: false,
                    error: `Channel ${channelId} does not belong to this server`
                }, 400);
            }
        }

        // Validate parentId references (must be categories in same server)
        const parentIds = [...new Set(channels.filter(c => c.parentId).map(c => c.parentId))];
        if (parentIds.length > 0) {
            const parentChannels = await databases.listDocuments(DATABASE_ID, 'channels', [
                Query.equal('$id', parentIds),
                Query.limit(parentIds.length)
            ]);

            const parentMap = new Map(parentChannels.documents.map(c => [c.$id, c]));

            for (const parentId of parentIds) {
                const parent = parentMap.get(parentId);
                if (!parent) {
                    return res.json({
                        success: false,
                        error: `Parent category ${parentId} not found`
                    }, 404);
                }
                if (parent.type !== 'category') {
                    return res.json({
                        success: false,
                        error: `Parent ${parentId} is not a category`
                    }, 400);
                }
                if (parent.serverId !== serverId) {
                    return res.json({
                        success: false,
                        error: `Parent category ${parentId} does not belong to this server`
                    }, 400);
                }
            }
        }

        // Batch update all channels
        const updatePromises = channels.map(channel =>
            databases.updateDocument(DATABASE_ID, 'channels', channel.id, {
                position: channel.position,
                parentId: channel.parentId ?? null
            })
        );

        const results = await Promise.all(updatePromises);

        log(`Reordered ${results.length} channels in server ${serverId}`);

        return res.json({
            success: true,
            data: {
                updated: results.length,
                channels: results.map(r => ({ id: r.$id, position: r.position, parentId: r.parentId }))
            }
        });
    } catch (err) {
        error(`Error reordering channels: ${err.message}`);
        return res.json({ success: false, error: 'Failed to reorder channels' }, 500);
    }
};
