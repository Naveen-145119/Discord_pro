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
    const COLLECTION_FRIENDS = 'friends';
    const COLLECTION_FRIEND_REQUESTS = 'friend_requests';

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { requestId, userId } = body;

        if (!requestId || !userId) {
            return res.json({
                success: false,
                error: 'Missing required fields: requestId, userId'
            }, 400);
        }

        // Security: Verify userId matches authenticated user
        const authenticatedUserId = req.headers['x-appwrite-user-id'];
        if (authenticatedUserId && authenticatedUserId !== userId) {
            error(`Authorization mismatch: header=${authenticatedUserId}, body=${userId}`);
            return res.json({ success: false, error: 'Unauthorized: User ID mismatch' }, 403);
        }

        let friendRequest;
        try {
            friendRequest = await databases.getDocument(DATABASE_ID, COLLECTION_FRIEND_REQUESTS, requestId);
        } catch {
            return res.json({ success: false, error: 'Friend request not found' }, 404);
        }

        if (friendRequest.receiverId !== userId) {
            return res.json({ success: false, error: 'You can only accept requests sent to you' }, 403);
        }

        if (friendRequest.status !== 'pending') {
            return res.json({ success: false, error: 'This request has already been processed' }, 400);
        }

        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_FRIEND_REQUESTS,
            requestId,
            { status: 'accepted' }
        );

        const [userId1, userId2] = [friendRequest.senderId, friendRequest.receiverId].sort();
        const friendship = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_FRIENDS,
            ID.unique(),
            {
                userId1,
                userId2
            }
        );

        log(`Friend request ${requestId} accepted. Friendship created: ${friendship.$id}`);

        return res.json({ success: true, data: friendship });
    } catch (err) {
        error(`Error accepting friend request: ${err.message}`);
        return res.json({ success: false, error: 'Failed to accept friend request' }, 500);
    }
};
