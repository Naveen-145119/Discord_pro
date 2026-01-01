# Backend - Appwrite Functions

This directory contains all Appwrite Functions for the Discord Pro backend.

## Functions

| Function | Description | Trigger |
|----------|-------------|---------|
| `send-message` | Create and validate messages | HTTP |
| `create-server` | Create server with role/channel setup | HTTP |
| `join-server` | Join via invite code or public | HTTP |
| `create-channel` | Create text/voice channels | HTTP |
| `webrtc-signal` | Voice state management | HTTP |
| `cleanup-expired` | Clean old data | Scheduled (5min) |

## Database Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles |
| `servers` | Server info |
| `server_members` | Server memberships |
| `channels` | Text/voice channels |
| `messages` | Chat messages |
| `roles` | Permission roles |
| `invites` | Invite links |
| `voice_states` | Voice connections |
| `typing_states` | Typing indicators |
| `dm_channels` | Direct messages |

## Setup

1. Install Appwrite CLI globally:
   ```bash
   npm install -g appwrite-cli
   ```

2. Login to Appwrite:
   ```bash
   appwrite login
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create `.env` from template:
   ```bash
   cp .env.example .env
   ```

5. Deploy everything:
   ```bash
   appwrite push
   ```

## Environment Variables

Required in Appwrite Console > Functions > Settings:

- `APPWRITE_ENDPOINT` - Appwrite API endpoint
- `APPWRITE_PROJECT_ID` - Your project ID
- `APPWRITE_API_KEY` - API key with all scopes
- `DATABASE_ID` - Database ID (default: `discord_db`)
