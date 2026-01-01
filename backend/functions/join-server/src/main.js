/**
 * Join Server - Appwrite Function
 * Allows users to join a server via invite or public listing
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

    const DEFAULT_PERMISSIONS = (
        (1n << 1n) |  // VIEW_CHANNELS
        (1n << 10n) | // SEND_MESSAGES
        (1n << 16n) | // READ_MESSAGE_HISTORY
        (1n << 13n) | // ADD_REACTIONS
        (1n << 20n) | // CONNECT
        (1n << 21n) | // SPEAK
        (1n << 28n) | // STREAM
        (1n << 32n)   // CREATE_INVITE
    ).toString();

    try {
        // Safe JSON parsing
        let body;
        try {
            body = JSON.parse(req.body || '{}');
        } catch {
            return res.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { serverId, userId, inviteCode } = body;

        // Validate required fields
        if (!userId || (!serverId && !inviteCode)) {
            return res.json({
                success: false,
                error: 'Missing required fields: userId and (serverId or inviteCode)'
            }, 400);
        }

        // Validate field types
        if (typeof userId !== 'string') {
            return res.json({ success: false, error: 'Invalid userId type' }, 400);
        }
        if (serverId && typeof serverId !== 'string') {
            return res.json({ success: false, error: 'Invalid serverId type' }, 400);
        }
        if (inviteCode && typeof inviteCode !== 'string') {
            return res.json({ success: false, error: 'Invalid inviteCode type' }, 400);
        }

        let targetServerId = serverId;

        // If invite code provided, validate and get server
        if (inviteCode) {
            let invite;
            try {
                invite = await databases.getDocument(DATABASE_ID, 'invites', inviteCode);
            } catch {
                return res.json({ success: false, error: 'Invalid invite code' }, 404);
            }

            // Check if expired
            if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
                return res.json({ success: false, error: 'Invite has expired' }, 400);
            }

            // Check max uses
            if (invite.maxUses && invite.uses >= invite.maxUses) {
                return res.json({ success: false, error: 'Invite has reached maximum uses' }, 400);
            }

            targetServerId = invite.serverId;

            // Atomically increment invite uses using current value check
            try {
                await databases.updateDocument(DATABASE_ID, 'invites', inviteCode, {
                    uses: invite.uses + 1
                });
            } catch (updateErr) {
                log(`Invite use increment failed (possible race): ${updateErr.message}`);
            }
        }

        // Check if server exists and is joinable
        let server;
        try {
            server = await databases.getDocument(DATABASE_ID, 'servers', targetServerId);
        } catch {
            return res.json({ success: false, error: 'Server not found' }, 404);
        }

        // If no invite provided, check if server is public
        if (!inviteCode && !server.isPublic) {
            return res.json({ success: false, error: 'Server is private. An invite is required.' }, 403);
        }

        // Check if already a member (prevent duplicates)
        const existingMembership = await databases.listDocuments(DATABASE_ID, 'server_members', [
            Query.equal('serverId', targetServerId),
            Query.equal('userId', userId),
            Query.limit(1)
        ]);

        if (existingMembership.documents.length > 0) {
            return res.json({ success: false, error: 'Already a member of this server' }, 400);
        }

        // Create membership with unique constraint protection
        let membership;
        try {
            membership = await databases.createDocument(
                DATABASE_ID,
                'server_members',
                ID.unique(),
                {
                    serverId: targetServerId,
                    userId,
                    nickname: null,
                    roleIds: JSON.stringify([]),
                    joinedAt: new Date().toISOString(),
                    permissionBits: DEFAULT_PERMISSIONS
                }
            );
        } catch (createErr) {
            if (createErr.message?.includes('duplicate')) {
                return res.json({ success: false, error: 'Already a member of this server' }, 400);
            }
            throw createErr;
        }

        // Update member count (non-critical, log errors but don't fail)
        try {
            const freshServer = await databases.getDocument(DATABASE_ID, 'servers', targetServerId);
            await databases.updateDocument(DATABASE_ID, 'servers', targetServerId, {
                memberCount: freshServer.memberCount + 1
            });
        } catch (countErr) {
            log(`Member count update failed: ${countErr.message}`);
        }

        // Create join message (non-critical)
        if (server.defaultChannelId) {
            try {
                await databases.createDocument(
                    DATABASE_ID,
                    'messages',
                    ID.unique(),
                    {
                        channelId: server.defaultChannelId,
                        authorId: userId,
                        content: 'has joined the server!',
                        type: 'join',
                        replyToId: null,
                        attachments: JSON.stringify([]),
                        embeds: JSON.stringify([]),
                        reactions: JSON.stringify([]),
                        mentionUserIds: JSON.stringify([]),
                        mentionRoleIds: JSON.stringify([]),
                        mentionEveryone: false,
                        isPinned: false,
                        isEdited: false,
                        editedAt: null
                    }
                );
            } catch (msgErr) {
                log(`Join message creation failed: ${msgErr.message}`);
            }
        }

        log(`User ${userId} joined server ${targetServerId}`);

        return res.json({
            success: true,
            data: { membership, server }
        });
    } catch (err) {
        error(`Error joining server: ${err.message}`);
        return res.json({ success: false, error: 'Failed to join server' }, 500);
    }
};
