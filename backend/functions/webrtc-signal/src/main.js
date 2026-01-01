/**
 * WebRTC Signaling - Appwrite Function
 * Simple signaling server for establishing peer connections
 */
import { Client, Databases, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = process.env.DATABASE_ID || 'discord_db';

    try {
        const { action, channelId, userId, data } = JSON.parse(req.body || '{}');

        // Validate required fields
        if (!action || !channelId || !userId) {
            return res.json({
                success: false,
                error: 'Missing required fields: action, channelId, userId'
            }, 400);
        }

        switch (action) {
            case 'join': {
                // User joining a voice channel
                const voiceState = await databases.createDocument(
                    DATABASE_ID,
                    'voice_states',
                    ID.unique(),
                    {
                        serverId: data?.serverId || null,
                        channelId,
                        userId,
                        isMuted: false,
                        isDeafened: false,
                        isSelfMuted: false,
                        isSelfDeafened: false,
                        isStreaming: false,
                        isVideoOn: false,
                        sessionId: ID.unique()
                    }
                );

                log(`User ${userId} joined voice channel ${channelId}`);

                return res.json({
                    success: true,
                    data: voiceState
                });
            }

            case 'leave': {
                // User leaving voice channel
                const voiceStates = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                    Query.equal('channelId', channelId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]);

                if (voiceStates.documents.length > 0) {
                    await databases.deleteDocument(
                        DATABASE_ID,
                        'voice_states',
                        voiceStates.documents[0].$id
                    );
                }

                log(`User ${userId} left voice channel ${channelId}`);

                return res.json({
                    success: true
                });
            }

            case 'update': {
                // Update voice state (mute, deafen, etc.)
                const voiceStates = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                    Query.equal('channelId', channelId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]);

                if (voiceStates.documents.length === 0) {
                    return res.json({
                        success: false,
                        error: 'Voice state not found'
                    }, 404);
                }

                const updateData = {};
                if (data.isSelfMuted !== undefined) updateData.isSelfMuted = data.isSelfMuted;
                if (data.isSelfDeafened !== undefined) updateData.isSelfDeafened = data.isSelfDeafened;
                if (data.isStreaming !== undefined) updateData.isStreaming = data.isStreaming;
                if (data.isVideoOn !== undefined) updateData.isVideoOn = data.isVideoOn;

                const updated = await databases.updateDocument(
                    DATABASE_ID,
                    'voice_states',
                    voiceStates.documents[0].$id,
                    updateData
                );

                return res.json({
                    success: true,
                    data: updated
                });
            }

            case 'offer':
            case 'answer':
            case 'ice-candidate': {
                // Signaling data - store temporarily for other peer to retrieve
                // In production, use Appwrite Realtime for instant delivery
                log(`Signaling ${action} from ${userId} in ${channelId}`);

                return res.json({
                    success: true,
                    message: `${action} signal received. Use Appwrite Realtime for peer delivery.`
                });
            }

            default:
                return res.json({
                    success: false,
                    error: `Unknown action: ${action}`
                }, 400);
        }
    } catch (err) {
        error(`WebRTC signaling error: ${err.message}`);
        return res.json({
            success: false,
            error: 'Signaling failed'
        }, 500);
    }
};
