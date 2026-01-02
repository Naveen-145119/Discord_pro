/**
 * WebRTC Signaling - Appwrite Function
 * Manages voice states and WebRTC signaling for peer connections
 */
import { Client, Databases, ID, Query, Permission, Role } from 'node-appwrite';

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

    try {
        // Safe JSON parsing
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { action, channelId, userId, data } = body;

        // Validate required fields
        if (!action || !channelId || !userId) {
            return res.json({
                success: false,
                error: 'Missing required fields: action, channelId, userId'
            }, 400);
        }

        // Validate field types
        if (typeof action !== 'string' || typeof channelId !== 'string' || typeof userId !== 'string') {
            return res.json({ success: false, error: 'Invalid field types' }, 400);
        }

        // Verify channel exists - can be server channel OR DM channel
        let channel;
        let isDMCall = false;

        try {
            channel = await databases.getDocument(DATABASE_ID, 'channels', channelId);

            // Check channel type is voice/stage for server channels
            if (!['voice', 'stage'].includes(channel.type)) {
                return res.json({ success: false, error: 'Channel is not a voice channel' }, 400);
            }

            // Verify user is member of the server
            if (channel.serverId) {
                const memberships = await databases.listDocuments(DATABASE_ID, 'server_members', [
                    Query.equal('serverId', channel.serverId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]);

                if (memberships.documents.length === 0) {
                    return res.json({ success: false, error: 'You are not a member of this server' }, 403);
                }
            }
        } catch {
            // Not a server channel - check if it's a DM channel
            try {
                const dmChannel = await databases.getDocument(DATABASE_ID, 'dm_channels', channelId);
                const participants = typeof dmChannel.participantIds === 'string'
                    ? JSON.parse(dmChannel.participantIds)
                    : dmChannel.participantIds;

                if (!participants.includes(userId)) {
                    return res.json({ success: false, error: 'You are not a participant in this DM' }, 403);
                }

                isDMCall = true;
                channel = { $id: channelId, type: 'dm' };
                log(`DM call detected for channel ${channelId}`);
            } catch {
                return res.json({ success: false, error: 'Channel not found' }, 404);
            }
        }

        switch (action) {
            case 'join': {
                // Check if already in this channel (prevent duplicates)
                const existing = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                    Query.equal('channelId', channelId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]);

                if (existing.documents.length > 0) {
                    return res.json({ success: true, data: existing.documents[0] });
                }

                // Leave any other voice channel first
                const otherStates = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                    Query.equal('userId', userId),
                    Query.limit(10)
                ]);

                for (const state of otherStates.documents) {
                    try {
                        await databases.deleteDocument(DATABASE_ID, 'voice_states', state.$id);
                    } catch (delErr) {
                        log(`Failed to delete old voice state: ${delErr.message}`);
                    }
                }

                // Create new voice state
                const voiceState = await databases.createDocument(
                    DATABASE_ID,
                    'voice_states',
                    ID.unique(),
                    {
                        serverId: channel.serverId || null,
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
                return res.json({ success: true, data: voiceState });
            }

            case 'leave': {
                const voiceStates = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                    Query.equal('channelId', channelId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]);

                if (voiceStates.documents.length > 0) {
                    await databases.deleteDocument(DATABASE_ID, 'voice_states', voiceStates.documents[0].$id);
                }

                log(`User ${userId} left voice channel ${channelId}`);
                return res.json({ success: true });
            }

            case 'update': {
                const voiceStates = await databases.listDocuments(DATABASE_ID, 'voice_states', [
                    Query.equal('channelId', channelId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]);

                if (voiceStates.documents.length === 0) {
                    return res.json({ success: false, error: 'Voice state not found' }, 404);
                }

                // Safely extract update data with type checking
                const updateData = {};
                if (data && typeof data === 'object') {
                    if (typeof data.isSelfMuted === 'boolean') updateData.isSelfMuted = data.isSelfMuted;
                    if (typeof data.isSelfDeafened === 'boolean') updateData.isSelfDeafened = data.isSelfDeafened;
                    if (typeof data.isStreaming === 'boolean') updateData.isStreaming = data.isStreaming;
                    if (typeof data.isVideoOn === 'boolean') updateData.isVideoOn = data.isVideoOn;
                }

                if (Object.keys(updateData).length === 0) {
                    return res.json({ success: false, error: 'No valid update fields provided' }, 400);
                }

                const updated = await databases.updateDocument(
                    DATABASE_ID,
                    'voice_states',
                    voiceStates.documents[0].$id,
                    updateData
                );

                return res.json({ success: true, data: updated });
            }

            case 'offer':
            case 'answer':
            case 'ice-candidate': {
                if (!data || typeof data !== 'object') {
                    return res.json({ success: false, error: 'Missing signaling data' }, 400);
                }

                const { targetUserId, sdp, candidate } = data;

                if (!targetUserId || typeof targetUserId !== 'string') {
                    return res.json({ success: false, error: 'Missing targetUserId' }, 400);
                }

                // Create signaling document with proper permissions
                // Both sender and receiver need to read for Realtime to work
                const signal = await databases.createDocument(
                    DATABASE_ID,
                    'webrtc_signals',
                    ID.unique(),
                    {
                        channelId,
                        fromUserId: userId,
                        toUserId: targetUserId,
                        type: action,
                        sdp: sdp || null,
                        candidate: candidate ? JSON.stringify(candidate) : null,
                        expiresAt: new Date(Date.now() + 30000).toISOString()
                    },
                    [
                        Permission.read(Role.user(userId)),
                        Permission.read(Role.user(targetUserId)),
                    ]
                );

                log(`Signaling ${action} from ${userId} to ${targetUserId} in ${channelId}`);
                return res.json({ success: true, data: signal });
            }

            default:
                return res.json({ success: false, error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        error(`WebRTC signaling error: ${err.message}`);
        return res.json({ success: false, error: 'Signaling failed' }, 500);
    }
};
