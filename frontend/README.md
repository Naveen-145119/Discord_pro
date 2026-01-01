# Frontend - React + TypeScript + Vite

Discord-like UI built with React 18, TypeScript, and Tailwind CSS.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your Appwrite credentials
npm run dev
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── layout/        # Layout components (sidebars, etc.)
│   └── modals/        # Modal dialogs
├── lib/               # Core libraries
│   ├── appwrite.ts    # Appwrite client
│   ├── permissions.ts # Bitwise permission system
│   └── utils.ts       # Utility functions
├── pages/             # Page components
│   ├── auth/          # Login/Register
│   ├── HomePage.tsx   # DMs and friends
│   ├── ServerPage.tsx # Server view
│   └── ChannelPage.tsx# Chat view
├── stores/            # Zustand state stores
│   ├── authStore.ts   # Authentication state
│   ├── serverStore.ts # Servers and channels
│   └── messageStore.ts# Messages and realtime
└── types/             # TypeScript definitions
```

## Available Scripts

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Environment Variables

Create `.env` with:

```
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_DATABASE_ID=discord_db
```
