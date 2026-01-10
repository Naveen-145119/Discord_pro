import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

// LiveKit token generation endpoint (Blueprint Section 5.2)
export async function GET(req: NextRequest) {
    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username');

    if (!room || !username) {
        return NextResponse.json(
            { error: 'Missing room or username parameter' },
            { status: 400 }
        );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
        return NextResponse.json(
            { error: 'LiveKit credentials not configured' },
            { status: 500 }
        );
    }

    // Create access token with permissions
    const at = new AccessToken(apiKey, apiSecret, {
        identity: username,
        name: username,
        // Token expires in 1 hour
        ttl: '1h',
    });

    // Grant room permissions
    at.addGrant({
        room: room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token });
}
