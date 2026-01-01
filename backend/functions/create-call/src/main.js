import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    // 1. Initialize Appwrite Client
    const client = new Client()
        .setEndpoint('https://fra.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = 'discord_db';
    const COLLECTION_ID = 'active_calls';

    try {
        // 2. Parse User and Input
        const callerId = req.headers['x-appwrite-user-id'];
        if (!callerId) {
            return res.json({ success: false, error: 'Unauthorized' }, 401);
        }

        const payload = JSON.parse(req.body);
        const { receiverId, channelId, callType } = payload;

        if (!receiverId || !channelId || !callType) {
            return res.json({ success: false, error: 'Missing required fields' }, 400);
        }

        // 3. Create Call Document with Permissions
        // We use the Server SDK (admin key) so we can set any permissions we want.
        const call = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            ID.unique(),
            {
                callerId,
                receiverId,
                channelId,
                callType,
                status: 'ringing'
            },
            [
                Permission.read(Role.user(callerId)),
                Permission.read(Role.user(receiverId)),
                Permission.update(Role.user(callerId)),
                Permission.update(Role.user(receiverId)),
                Permission.delete(Role.user(callerId)),
                Permission.delete(Role.user(receiverId)),
            ]
        );

        return res.json({
            success: true,
            data: call
        });

    } catch (err) {
        error('Failed to create call: ' + err.message);
        return res.json({ success: false, error: err.message }, 500);
    }
};
