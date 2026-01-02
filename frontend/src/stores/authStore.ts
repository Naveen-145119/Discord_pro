import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { account, databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import type { User } from '@/types';
import { ID, Query } from 'appwrite';

interface AuthState {
    user: User | null;
    sessionId: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => Promise<void>;
    checkSession: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            sessionId: null,
            isLoading: true,
            isAuthenticated: false,
            error: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null });

                try {
                    const session = await account.createEmailPasswordSession(email, password);

                    const appwriteUser = await account.get();

                    const userDocs = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.USERS,
                        [Query.equal('email', email), Query.limit(1)]
                    );

                    let user: User;

                    if (userDocs.documents.length > 0) {
                        user = userDocs.documents[0] as unknown as User;
                    } else {
                        user = await databases.createDocument(
                            DATABASE_ID,
                            COLLECTIONS.USERS,
                            appwriteUser.$id,
                            {
                                username: appwriteUser.name || email.split('@')[0],
                                displayName: appwriteUser.name || email.split('@')[0],
                                email: email,
                                avatarUrl: null,
                                bannerUrl: null,
                                bio: null,
                                status: 'online',
                                customStatus: null,
                            }
                        ) as unknown as User;
                    }

                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.USERS,
                        user.$id,
                        { status: 'online' }
                    );

                    set({
                        user: { ...user, status: 'online' },
                        sessionId: session.$id,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Login failed';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            register: async (email, password, username) => {
                set({ isLoading: true, error: null });

                try {
                    const existingUsers = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.USERS,
                        [Query.equal('username', username), Query.limit(1)]
                    );

                    if (existingUsers.documents.length > 0) {
                        throw new Error('Username is already taken');
                    }

                    const newAccount = await account.create(ID.unique(), email, password, username);

                    await databases.createDocument(
                        DATABASE_ID,
                        COLLECTIONS.USERS,
                        newAccount.$id,
                        {
                            username,
                            displayName: username,
                            email,
                            avatarUrl: null,
                            bannerUrl: null,
                            bio: null,
                            status: 'offline',
                            customStatus: null,
                        }
                    );

                    await get().login(email, password);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Registration failed';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            logout: async () => {
                const { user } = get();

                try {
                    if (user) {
                        await databases.updateDocument(
                            DATABASE_ID,
                            COLLECTIONS.USERS,
                            user.$id,
                            { status: 'offline' }
                        ).catch(() => { });
                    }

                    await account.deleteSession('current');
                } catch {
                } finally {
                    set({
                        user: null,
                        sessionId: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            checkSession: async () => {
                set({ isLoading: true });

                try {
                    const session = await account.getSession('current');
                    const appwriteUser = await account.get();

                    const userDoc = await databases.getDocument(
                        DATABASE_ID,
                        COLLECTIONS.USERS,
                        appwriteUser.$id
                    ) as unknown as User;

                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.USERS,
                        userDoc.$id,
                        { status: 'online' }
                    );

                    set({
                        user: { ...userDoc, status: 'online' },
                        sessionId: session.$id,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch {
                    set({
                        user: null,
                        sessionId: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            updateUser: (updates) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null,
                }));
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'discord-auth',
            partialize: (state) => ({
                sessionId: state.sessionId,
            }),
        }
    )
);
