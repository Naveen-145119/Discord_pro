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
    const COLLECTION_FRIENDS = 'friends';

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { userId, friendId } = body;

        if (!userId || !friendId) {
            return res.json({
                success: false,
                error: 'Missing required fields: userId, friendId'
            }, 400);
        }

        // Security: Verify userId matches authenticated user
        const authenticatedUserId = req.headers['x-appwrite-user-id'];
        if (authenticatedUserId && authenticatedUserId !== userId) {
            error(`Authorization mismatch: header=${authenticatedUserId}, body=${userId}`);
            return res.json({ success: false, error: 'Unauthorized: User ID mismatch' }, 403);
        }

        const [userId1, userId2] = [userId, friendId].sort();
        const friendships = await databases.listDocuments(DATABASE_ID, COLLECTION_FRIENDS, [
            Query.equal('userId1', userId1),
            Query.equal('userId2', userId2),
            Query.limit(1)
        ]);

        if (friendships.documents.length === 0) {
            return res.json({ success: false, error: 'Friendship not found' }, 404);
        }

        const friendship = friendships.documents[0];

        await databases.deleteDocument(DATABASE_ID, COLLECTION_FRIENDS, friendship.$id);

        log(`Friendship removed: ${userId} <-> ${friendId}`);

        return res.json({ success: true, message: 'Friend removed successfully' });
    } catch (err) {
        error(`Error removing friend: ${err.message}`);
        return res.json({ success: false, error: 'Failed to remove friend' }, 500);
    }
};
