/**
 * Decline Friend Request - Appwrite Function
 * Declines a pending friend request
 */
import { Client, Databases } from 'node-appwrite';

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
    const COLLECTION_FRIEND_REQUESTS = 'friend_requests';

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { requestId, userId } = body;

        // Validate required fields
        if (!requestId || !userId) {
            return res.json({
                success: false,
                error: 'Missing required fields: requestId, userId'
            }, 400);
        }

        // Get the friend request
        let friendRequest;
        try {
            friendRequest = await databases.getDocument(DATABASE_ID, COLLECTION_FRIEND_REQUESTS, requestId);
        } catch {
            return res.json({ success: false, error: 'Friend request not found' }, 404);
        }

        // Verify the user is the receiver
        if (friendRequest.receiverId !== userId) {
            return res.json({ success: false, error: 'You can only decline requests sent to you' }, 403);
        }

        // Verify request is pending
        if (friendRequest.status !== 'pending') {
            return res.json({ success: false, error: 'This request has already been processed' }, 400);
        }

        // Update request status to declined
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_FRIEND_REQUESTS,
            requestId,
            { status: 'declined' }
        );

        log(`Friend request ${requestId} declined by ${userId}`);

        return res.json({ success: true, message: 'Friend request declined' });
    } catch (err) {
        error(`Error declining friend request: ${err.message}`);
        return res.json({ success: false, error: 'Failed to decline friend request' }, 500);
    }
};
