'use client';

import { create } from 'zustand';
import { createContext, useContext, useEffect, useState } from 'react';

// Modal types
export type ModalType =
    | 'createServer'
    | 'editServer'
    | 'deleteServer'
    | 'leaveServer'
    | 'inviteMembers'
    | 'createChannel'
    | 'editChannel'
    | 'deleteChannel'
    | 'members'
    | 'messageFile'
    | 'deleteMessage'
    | 'settings'
    | 'userProfile'
    | null;

// Modal data that can be passed to modals
interface ModalData {
    serverId?: string;
    channelId?: string;
    messageId?: string;
    userId?: string;
    channelType?: 'text' | 'voice' | 'video';
}

// Modal store interface
interface ModalStore {
    type: ModalType;
    data: ModalData;
    isOpen: boolean;
    openModal: (type: ModalType, data?: ModalData) => void;
    closeModal: () => void;
}

// Zustand store for modals
export const useModalStore = create<ModalStore>((set) => ({
    type: null,
    data: {},
    isOpen: false,
    openModal: (type, data = {}) => set({ type, data, isOpen: true }),
    closeModal: () => set({ type: null, data: {}, isOpen: false }),
}));

// Modal context for provider pattern
const ModalContext = createContext<boolean>(false);

// Provider that mounts all modals
export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <>{children}</>;
    }

    return (
        <ModalContext.Provider value={true}>
            {children}
            {/* All modals will be rendered here */}
            <ModalContainer />
        </ModalContext.Provider>
    );
}

// Container that renders the appropriate modal based on store state
function ModalContainer() {
    const { type, isOpen } = useModalStore();

    if (!isOpen || !type) return null;

    // Modals will be added here as components are built
    // For now, return null - modals will be implemented in Phase 2
    return null;
}

// Hook to check if modals are mounted
export function useModalMounted() {
    return useContext(ModalContext);
}
