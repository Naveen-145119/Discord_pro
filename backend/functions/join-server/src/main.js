/**
 * Join Server - Appwrite Function
 * Allows users to join a server via invite or public listing
 */
import { Client, Databases, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const DATABASE_ID = process.env.DATABASE_ID || 'discord_db';

    // Default permissions for new members
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
        const { serverId, userId, inviteCode } = JSON.parse(req.body || '{}');

        // Validate required fields
        if (!userId || (!serverId && !inviteCode)) {
            return res.json({
                success: false,
                error: 'Missing required fields: userId and (serverId or inviteCode)'
            }, 400);
        }

        let targetServerId = serverId;

        // If invite code provided, validate and get server
        if (inviteCode) {
            const invites = await databases.listDocuments(DATABASE_ID, 'invites', [
                Query.equal('$id', inviteCode),
                Query.limit(1)
            ]);

            if (invites.documents.length === 0) {
                return res.json({
                    success: false,
                    error: 'Invalid invite code'
                }, 404);
            }

            const invite = invites.documents[0];

            // Check if expired
            if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
                return res.json({
                    success: false,
                    error: 'Invite has expired'
                }, 400);
            }

            // Check max uses
            if (invite.maxUses && invite.uses >= invite.maxUses) {
                return res.json({
                    success: false,
                    error: 'Invite has reached maximum uses'
                }, 400);
            }

            targetServerId = invite.serverId;

            // Increment invite uses
            await databases.updateDocument(DATABASE_ID, 'invites', inviteCode, {
                uses: invite.uses + 1
            });
        }

        // Check if server exists
        let server;
        try {
            server = await databases.getDocument(DATABASE_ID, 'servers', targetServerId);
        } catch {
            return res.json({
                success: false,
                error: 'Server not found'
            }, 404);
        }

        // Check if already a member
        const existingMembership = await databases.listDocuments(DATABASE_ID, 'server_members', [
            Query.equal('serverId', targetServerId),
            Query.equal('userId', userId),
            Query.limit(1)
        ]);

        if (existingMembership.documents.length > 0) {
            return res.json({
                success: false,
                error: 'Already a member of this server'
            }, 400);
        }

        // Add as member
        const membership = await databases.createDocument(
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

        // Increment member count
        await databases.updateDocument(DATABASE_ID, 'servers', targetServerId, {
            memberCount: server.memberCount + 1
        });

        // Create join message in default channel
        if (server.defaultChannelId) {
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
        }

        log(`User ${userId} joined server ${targetServerId}`);

        return res.json({
            success: true,
            data: {
                membership,
                server
            }
        });
    } catch (err) {
        error(`Error joining server: ${err.message}`);
        return res.json({
            success: false,
            error: 'Failed to join server'
        }, 500);
    }
};
