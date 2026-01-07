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
    const COLLECTION_USERS = 'users';
    const COLLECTION_FRIENDS = 'friends';
    const COLLECTION_FRIEND_REQUESTS = 'friend_requests';

    try {
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { senderId, receiverUsername } = body;

        if (!senderId || !receiverUsername) {
            return res.json({
                success: false,
                error: 'Missing required fields: senderId, receiverUsername'
            }, 400);
        }

        // Security: Verify senderId matches authenticated user
        const authenticatedUserId = req.headers['x-appwrite-user-id'];
        if (authenticatedUserId && authenticatedUserId !== senderId) {
            error(`Authorization mismatch: header=${authenticatedUserId}, body=${senderId}`);
            return res.json({ success: false, error: 'Unauthorized: User ID mismatch' }, 403);
        }

        const receiverDocs = await databases.listDocuments(DATABASE_ID, COLLECTION_USERS, [
            Query.equal('username', receiverUsername),
            Query.limit(1)
        ]);

        if (receiverDocs.documents.length === 0) {
            return res.json({ success: false, error: 'User not found' }, 404);
        }

        const receiver = receiverDocs.documents[0];
        const receiverId = receiver.$id;

        if (senderId === receiverId) {
            return res.json({ success: false, error: 'You cannot send a friend request to yourself' }, 400);
        }

        const [userId1, userId2] = [senderId, receiverId].sort();
        const existingFriends = await databases.listDocuments(DATABASE_ID, COLLECTION_FRIENDS, [
            Query.equal('userId1', userId1),
            Query.equal('userId2', userId2),
            Query.limit(1)
        ]);

        if (existingFriends.documents.length > 0) {
            return res.json({ success: false, error: 'You are already friends with this user' }, 400);
        }

        const existingRequests = await databases.listDocuments(DATABASE_ID, COLLECTION_FRIEND_REQUESTS, [
            Query.equal('status', 'pending'),
            Query.limit(100)
        ]);

        const duplicateRequest = existingRequests.documents.find(r =>
            (r.senderId === senderId && r.receiverId === receiverId) ||
            (r.senderId === receiverId && r.receiverId === senderId)
        );

        if (duplicateRequest) {
            if (duplicateRequest.senderId === receiverId) {
                return res.json({
                    success: false,
                    error: 'This user has already sent you a friend request. Check your pending requests!'
                }, 400);
            }
            return res.json({ success: false, error: 'Friend request already sent' }, 400);
        }

        const friendRequest = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_FRIEND_REQUESTS,
            ID.unique(),
            {
                senderId,
                receiverId,
                status: 'pending'
            }
        );

        log(`Friend request sent: ${senderId} -> ${receiverId}`);

        return res.json({
            success: true,
            data: {
                ...friendRequest,
                receiver: {
                    $id: receiver.$id,
                    username: receiver.username,
                    displayName: receiver.displayName,
                    avatarUrl: receiver.avatarUrl
                }
            }
        });
    } catch (err) {
        error(`Error sending friend request: ${err.message}`);
        return res.json({ success: false, error: 'Failed to send friend request' }, 500);
    }
};
