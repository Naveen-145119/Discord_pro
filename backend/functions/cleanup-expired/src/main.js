import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = process.env.DATABASE_ID || 'discord_db';

    let cleaned = {
        invites: 0,
        typingStates: 0,
        voiceStates: 0,
        webrtcSignals: 0,
        activeCalls: 0
    };

    try {
        const now = new Date().toISOString();

        try {
            const expiredInvites = await databases.listDocuments(DATABASE_ID, 'invites', [
                Query.lessThan('expiresAt', now),
                Query.limit(100)
            ]);

            for (const invite of expiredInvites.documents) {
                await databases.deleteDocument(DATABASE_ID, 'invites', invite.$id);
                cleaned.invites++;
            }
        } catch (err) {
            log(`Invites cleanup skipped: ${err.message}`);
        }

        try {
            const typingStates = await databases.listDocuments(DATABASE_ID, 'typing_states', [
                Query.lessThan('expiresAt', now),
                Query.limit(100)
            ]);

            for (const state of typingStates.documents) {
                await databases.deleteDocument(DATABASE_ID, 'typing_states', state.$id);
                cleaned.typingStates++;
            }
        } catch (err) {
            log(`Typing states cleanup skipped: ${err.message}`);
        }

        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const staleVoiceStates = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                Query.lessThan('$updatedAt', oneHourAgo),
                Query.limit(100)
            ]);

            for (const state of staleVoiceStates.documents) {
                await databases.deleteDocument(DATABASE_ID, 'voice_states', state.$id);
                cleaned.voiceStates++;
            }
        } catch (err) {
            log(`Voice states cleanup skipped: ${err.message}`);
        }

        try {
            const expiredSignals = await databases.listDocuments(DATABASE_ID, 'webrtc_signals', [
                Query.lessThan('expiresAt', now),
                Query.limit(100)
            ]);

            for (const signal of expiredSignals.documents) {
                await databases.deleteDocument(DATABASE_ID, 'webrtc_signals', signal.$id);
                cleaned.webrtcSignals++;
            }
        } catch (err) {
            log(`WebRTC signals cleanup skipped: ${err.message}`);
        }

        try {
            const oneHourAgo2 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const staleCalls = await databases.listDocuments(DATABASE_ID, 'active_calls', [
                Query.lessThan('$updatedAt', oneHourAgo2),
                Query.limit(100)
            ]);

            for (const call of staleCalls.documents) {
                await databases.deleteDocument(DATABASE_ID, 'active_calls', call.$id);
                cleaned.activeCalls++;
            }
        } catch (err) {
            log(`Active calls cleanup skipped: ${err.message}`);
        }

        log(`Cleanup complete: ${JSON.stringify(cleaned)}`);

        return res.json({
            success: true,
            data: cleaned
        });
    } catch (err) {
        error(`Cleanup error: ${err.message}`);
        return res.json({
            success: false,
            error: 'Cleanup failed'
        }, 500);
    }
};
