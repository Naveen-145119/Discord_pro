/**
 * Create DM Channel - Appwrite Function
 * Creates or retrieves existing DM channel between two users
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
    const COLLECTION_DM_CHANNELS = 'dm_channels';
    const COLLECTION_USERS = 'users';

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { userId, friendId } = body;

        // Validate required fields
        if (!userId || !friendId) {
            return res.json({
                success: false,
                error: 'Missing required fields: userId, friendId'
            }, 400);
        }

        // Prevent DM with self
        if (userId === friendId) {
            return res.json({ success: false, error: 'Cannot create DM with yourself' }, 400);
        }

        // Sort participant IDs for consistent lookup (smaller ID first)
        const participantIds = [userId, friendId].sort();

        // Check if DM channel already exists between these users
        const existingDMs = await databases.listDocuments(DATABASE_ID, COLLECTION_DM_CHANNELS, [
            Query.contains('participantIds', participantIds[0]),
            Query.limit(100)
        ]);

        // Find exact match (both participants)
        const existingDM = existingDMs.documents.find(dm => {
            const ids = dm.participantIds;
            return ids.length === 2 &&
                ids.includes(participantIds[0]) &&
                ids.includes(participantIds[1]);
        });

        if (existingDM) {
            log(`DM channel already exists: ${existingDM.$id}`);

            // Fetch friend's user data
            const friendData = await databases.getDocument(DATABASE_ID, COLLECTION_USERS, friendId);

            return res.json({
                success: true,
                data: {
                    ...existingDM,
                    friend: {
                        $id: friendData.$id,
                        username: friendData.username,
                        displayName: friendData.displayName,
                        avatarUrl: friendData.avatarUrl,
                        status: friendData.status
                    }
                },
                isNew: false
            });
        }

        // Create new DM channel
        const dmChannel = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_DM_CHANNELS,
            ID.unique(),
            {
                participantIds: participantIds,
                lastMessageAt: null,
                lastMessagePreview: null
            }
        );

        log(`Created new DM channel: ${dmChannel.$id} between ${userId} and ${friendId}`);

        // Fetch friend's user data
        const friendData = await databases.getDocument(DATABASE_ID, COLLECTION_USERS, friendId);

        return res.json({
            success: true,
            data: {
                ...dmChannel,
                friend: {
                    $id: friendData.$id,
                    username: friendData.username,
                    displayName: friendData.displayName,
                    avatarUrl: friendData.avatarUrl,
                    status: friendData.status
                }
            },
            isNew: true
        });
    } catch (err) {
        error(`Error creating DM channel: ${err.message}`);
        return res.json({ success: false, error: 'Failed to create DM channel' }, 500);
    }
};
