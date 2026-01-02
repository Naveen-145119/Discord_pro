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
    const COLLECTION_DM_CHANNELS = 'dm_channels';
    const COLLECTION_USERS = 'users';

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

        if (userId === friendId) {
            return res.json({ success: false, error: 'Cannot create DM with yourself' }, 400);
        }

        const participantIds = [userId, friendId].sort();
        const participantIdsString = JSON.stringify(participantIds);

        const existingDMs = await databases.listDocuments(DATABASE_ID, COLLECTION_DM_CHANNELS, [
            Query.equal('participantIds', participantIdsString),
            Query.limit(1)
        ]);

        if (existingDMs.documents.length > 0) {
            const existingDM = existingDMs.documents[0];
            log(`DM channel already exists: ${existingDM.$id}`);

            const friendData = await databases.getDocument(DATABASE_ID, COLLECTION_USERS, friendId);

            return res.json({
                success: true,
                data: {
                    ...existingDM,
                    participantIds: JSON.parse(existingDM.participantIds),
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

        const dmChannel = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_DM_CHANNELS,
            ID.unique(),
            {
                participantIds: participantIdsString,
                lastMessageAt: null,
                lastMessagePreview: null
            }
        );

        log(`Created new DM channel: ${dmChannel.$id} between ${userId} and ${friendId}`);

        const friendData = await databases.getDocument(DATABASE_ID, COLLECTION_USERS, friendId);

        return res.json({
            success: true,
            data: {
                ...dmChannel,
                participantIds: participantIds,
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
