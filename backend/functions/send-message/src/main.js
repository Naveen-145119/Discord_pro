/**
 * Send Message - Appwrite Function
 * Validates and stores messages with realtime triggers
 */
import { Client, Databases, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    // Validate environment variables
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
    const COLLECTION_MESSAGES = 'messages';
    const COLLECTION_CHANNELS = 'channels';
    const COLLECTION_MEMBERS = 'server_members';

    try {
        // Parse request body safely
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { channelId, authorId, content, replyToId } = body;

        // Validate required fields
        if (!channelId || !authorId || !content) {
            return res.json({
                success: false,
                error: 'Missing required fields: channelId, authorId, content'
            }, 400);
        }

        // Validate field types
        if (typeof channelId !== 'string' || typeof authorId !== 'string' || typeof content !== 'string') {
            return res.json({ success: false, error: 'Invalid field types' }, 400);
        }

        // Trim content first, then validate length
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
            return res.json({ success: false, error: 'Message content cannot be empty' }, 400);
        }
        if (trimmedContent.length > 4000) {
            return res.json({ success: false, error: 'Message content exceeds 4000 characters' }, 400);
        }

        // Verify channel exists
        let channel;
        try {
            channel = await databases.getDocument(DATABASE_ID, COLLECTION_CHANNELS, channelId);
        } catch {
            return res.json({ success: false, error: 'Channel not found' }, 404);
        }

        // If server channel, verify user is a member using Query objects (NOT string interpolation)
        if (channel.serverId) {
            const members = await databases.listDocuments(DATABASE_ID, COLLECTION_MEMBERS, [
                Query.equal('serverId', channel.serverId),
                Query.equal('userId', authorId),
                Query.limit(1)
            ]);

            if (members.documents.length === 0) {
                return res.json({
                    success: false,
                    error: 'You are not a member of this server'
                }, 403);
            }
        }

        // Create the message
        const message = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_MESSAGES,
            ID.unique(),
            {
                channelId,
                authorId,
                content: trimmedContent,
                type: replyToId ? 'reply' : 'default',
                replyToId: replyToId || null,
                attachments: JSON.stringify([]),
                metadata: JSON.stringify({
                    embeds: [],
                    reactions: [],
                    mentionRoleIds: []
                }),
                mentionUserIds: JSON.stringify([]),
                mentionEveryone: false,
                isPinned: false,
                isEdited: false,
                editedAt: null,
            }
        );

        log(`Message sent: ${message.$id} to channel ${channelId}`);

        return res.json({ success: true, data: message });
    } catch (err) {
        error(`Error sending message: ${err.message}`);
        return res.json({ success: false, error: 'Failed to send message' }, 500);
    }
};
