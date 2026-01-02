import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Hash,
    Volume2,
    ChevronDown,
    Settings,
    Plus,
    Mic,
    Headphones,
    GripVertical
} from 'lucide-react';
import type { Server, Channel } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore, type ChannelReorderItem } from '@/stores/serverStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUnreadStore } from '@/stores/unreadStore';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';

interface ChannelSidebarProps {
    server: Server;
    channels: Channel[];
}

export function ChannelSidebar({ server, channels }: ChannelSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { reorderChannels } = useServerStore();
    const { can } = usePermission(server.$id);
    const canManageChannels = can(PERMISSIONS.MANAGE_CHANNELS);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    const currentChannelId = location.pathname.match(/\/channels\/([^/]+)/)?.[1];

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Organize channels by parent
    const { categories, channelsByParent } = useMemo(() => {
        const cats = channels.filter(c => c.type === 'category').sort((a, b) => a.position - b.position);
        const nonCatChannels = channels.filter(c => c.type !== 'category').sort((a, b) => a.position - b.position);

        const byParent = new Map<string | null, Channel[]>();
        byParent.set(null, []);
        cats.forEach(cat => byParent.set(cat.$id, []));

        nonCatChannels.forEach(channel => {
            const parentId = channel.parentId;
            if (byParent.has(parentId)) {
                byParent.get(parentId)!.push(channel);
            } else {
                byParent.get(null)!.push(channel);
            }
        });

        return {
            categories: cats,
            channelsByParent: byParent,
            sortedChannels: nonCatChannels,
        };
    }, [channels]);

    const handleChannelClick = (channel: Channel) => {
        navigate(`/servers/${server.$id}/channels/${channel.$id}`);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        setOverId(event.over?.id as string | null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over || active.id === over.id || !user?.$id || !canManageChannels) {
            return;
        }

        const activeChannel = channels.find(c => c.$id === active.id);
        if (!activeChannel || activeChannel.type === 'category') {
            return;
        }

        // Determine the target parent
        const overChannel = channels.find(c => c.$id === over.id);
        let targetParentId: string | null = null;

        if (overChannel) {
            if (overChannel.type === 'category') {
                // Dropped on a category - make it a child of that category
                targetParentId = overChannel.$id;
            } else {
                // Dropped on another channel - use the same parent
                targetParentId = overChannel.parentId;
            }
        }

        // Get siblings in target parent
        const siblings = channelsByParent.get(targetParentId) || [];
        const oldIndex = siblings.findIndex(c => c.$id === active.id);
        const newIndex = siblings.findIndex(c => c.$id === over.id);

        // Calculate new positions
        const updates: ChannelReorderItem[] = [];

        // If moving to a different parent or within same parent
        const isMovingToNewParent = activeChannel.parentId !== targetParentId;

        if (isMovingToNewParent) {
            // Add the moving channel with new parent
            updates.push({
                id: activeChannel.$id,
                position: siblings.length, // Add at end
                parentId: targetParentId,
            });
        } else if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            // Reorder within same parent
            const reorderedSiblings = [...siblings];
            const [removed] = reorderedSiblings.splice(oldIndex, 1);
            reorderedSiblings.splice(newIndex, 0, removed);

            reorderedSiblings.forEach((channel, index) => {
                updates.push({
                    id: channel.$id,
                    position: index,
                    parentId: targetParentId,
                });
            });
        }

        if (updates.length > 0) {
            try {
                await reorderChannels(server.$id, user.$id, updates);
            } catch (err) {
                console.error('Failed to reorder channels:', err);
            }
        }
    };

    const activeChannel = activeId ? channels.find(c => c.$id === activeId) : null;

    return (
        <div className="w-60 bg-background-secondary flex flex-col">
            <button className="h-12 px-4 flex items-center justify-between border-b border-background-tertiary shadow-elevation-low hover:bg-background-modifier-hover transition-colors">
                <span className="font-semibold text-text-heading truncate flex-1">
                    {server.name}
                </span>
                {can(PERMISSIONS.MANAGE_SERVER) && (
                    <Settings size={16} className="text-interactive-normal hover:text-interactive-hover mr-2 flex-shrink-0" />
                )}
                <ChevronDown size={18} className="text-interactive-normal flex-shrink-0" />
            </button>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
                    {/* Uncategorized channels */}
                    <SortableContext
                        items={channelsByParent.get(null)?.map(c => c.$id) || []}
                        strategy={verticalListSortingStrategy}
                    >
                        {channelsByParent.get(null)?.map(channel => (
                            <SortableChannelItem
                                key={channel.$id}
                                channel={channel}
                                isActive={currentChannelId === channel.$id}
                                isDragging={activeId === channel.$id}
                                isOver={overId === channel.$id}
                                onClick={() => handleChannelClick(channel)}
                                canDrag={canManageChannels}
                            />
                        ))}
                    </SortableContext>

                    {/* Categories with their channels */}
                    {categories.map(category => (
                        <div key={category.$id} className="pt-4 first:pt-0">
                            <SortableContext
                                items={[category.$id]}
                                strategy={verticalListSortingStrategy}
                            >
                                <DroppableCategory
                                    category={category}
                                    canManage={canManageChannels}
                                    isOver={overId === category.$id}
                                />
                            </SortableContext>

                            <SortableContext
                                items={channelsByParent.get(category.$id)?.map(c => c.$id) || []}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-0.5 mt-1">
                                    {channelsByParent.get(category.$id)?.map(channel => (
                                        <SortableChannelItem
                                            key={channel.$id}
                                            channel={channel}
                                            isActive={currentChannelId === channel.$id}
                                            isDragging={activeId === channel.$id}
                                            isOver={overId === channel.$id}
                                            onClick={() => handleChannelClick(channel)}
                                            canDrag={canManageChannels}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </div>
                    ))}
                </div>

                <DragOverlay>
                    {activeChannel ? (
                        <div className="channel-item w-full bg-background-tertiary rounded shadow-lg opacity-90">
                            {activeChannel.type === 'voice' ? (
                                <Volume2 size={18} className="flex-shrink-0" />
                            ) : (
                                <Hash size={18} className="flex-shrink-0" />
                            )}
                            <span className="truncate">{activeChannel.name}</span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* User panel */}
            <div className="p-2 bg-background-secondary-alt">
                <div className="flex items-center gap-2 p-1 rounded hover:bg-background-modifier-hover">
                    <div className="relative">
                        <div className="avatar w-8 h-8 bg-discord-primary">
                            <span className="text-xs font-medium text-white">
                                {user?.displayName?.charAt(0) || '?'}
                            </span>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-status-online rounded-full border-[3px] border-background-secondary-alt" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-normal truncate">
                            {user?.displayName}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                            Online
                        </p>
                    </div>

                    <div className="flex items-center gap-0.5">
                        <button
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="Mute"
                        >
                            <Mic size={18} />
                        </button>
                        <button
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="Deafen"
                        >
                            <Headphones size={18} />
                        </button>
                        <button
                            onClick={() => useSettingsStore.getState().openSettings()}
                            className="p-1.5 rounded hover:bg-background-modifier-active text-interactive-normal hover:text-interactive-hover"
                            title="User Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sortable Channel Item Component
function SortableChannelItem({
    channel,
    isActive,
    isDragging,
    isOver,
    onClick,
    canDrag,
}: {
    channel: Channel;
    isActive: boolean;
    isDragging: boolean;
    isOver: boolean;
    onClick: () => void;
    canDrag: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: channel.$id, disabled: !canDrag });

    const { hasUnread, getUnreadCount } = useUnreadStore();
    const isUnread = hasUnread(channel.$id);
    const unreadCount = getUnreadCount(channel.$id);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const Icon = channel.type === 'voice' ? Volume2 : Hash;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center mx-2 ${isOver ? 'ring-2 ring-discord-primary rounded' : ''}`}
        >
            {/* Unread indicator pill */}
            {isUnread && !isActive && (
                <div className="absolute left-0 w-1 h-2 bg-white rounded-r-full" />
            )}
            {canDrag && (
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-text-muted hover:text-text-normal cursor-grab active:cursor-grabbing"
                >
                    <GripVertical size={14} />
                </button>
            )}
            <button
                onClick={onClick}
                className={`channel-item flex-1 ${isActive ? 'active' : ''} ${!canDrag ? 'ml-2' : ''}`}
            >
                <Icon size={18} className="flex-shrink-0" />
                <span className={`truncate ${isUnread && !isActive ? 'font-semibold text-white' : ''}`}>
                    {channel.name}
                </span>
                {/* Unread count badge */}
                {unreadCount > 0 && !isActive && (
                    <span className="ml-auto px-1.5 py-0.5 bg-discord-red text-white text-xs font-bold rounded-full min-w-[18px] text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
}

// Droppable Category Component
function DroppableCategory({
    category,
    canManage,
    isOver,
}: {
    category: Channel;
    canManage: boolean;
    isOver: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
    } = useSortable({ id: category.$id, disabled: true });

    return (
        <div
            ref={setNodeRef}
            className={`flex items-center gap-1 px-1 py-1 w-full text-left group ${isOver ? 'bg-background-modifier-hover rounded' : ''}`}
            {...attributes}
            {...listeners}
        >
            <ChevronDown size={12} className="text-channel-text" />
            <span className="text-xs font-semibold text-channel-text uppercase tracking-wide truncate flex-1">
                {category.name}
            </span>
            {canManage && (
                <Plus
                    size={16}
                    className="text-channel-text opacity-0 group-hover:opacity-100 transition-opacity"
                />
            )}
        </div>
    );
}
