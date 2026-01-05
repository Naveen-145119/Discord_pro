/**
 * InCallChatSection - Chat section for use during calls
 * Provides full messaging functionality including emojis, GIFs, attachments
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import {
    PlusCircle,
    Gift,
    Smile,
    SendHorizontal,
    Image,
    Hash,
    X,
    Search
} from 'lucide-react';
import { useMessageStore, subscribeToMessages } from '@/stores/messageStore';
import { MessageList, ReplyBar, TypingIndicator } from '@/components/chat';
import type { User, Message } from '@/types';

// Common emojis organized by category
const EMOJI_CATEGORIES: Record<string, string[]> = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
    'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    'Objects': ['🎮', '🎲', '🎯', '🎭', '🎨', '🎬', '🎤', '🎧', '📱', '💻', '🖥️', '📷', '📹', '📺', '📻', '💡', '🔋', '💸', '💰'],
};

// GIF categories for browsing
const GIF_CATEGORIES = ['Trending', 'Reactions', 'Happy', 'Sad', 'Love'];

// Sample GIF URLs
const SAMPLE_GIFS: Record<string, string[]> = {
    'Trending': [
        'https://media.tenor.com/x8v1oNUOmg4AAAAC/rickroll-roll.gif',
        'https://media.tenor.com/DHi3LbNmtE8AAAAC/cat-cute.gif',
        'https://media.tenor.com/gW3uHMm0YSkAAAAC/dog-funny.gif',
    ],
    'Reactions': [
        'https://media.tenor.com/PbrC8VLXs_sAAAAC/omg-surprised.gif',
        'https://media.tenor.com/WpiNwPm5pY0AAAAC/facepalm.gif',
        'https://media.tenor.com/VFZ1P-5WndMAAAAC/thumbs-up.gif',
    ],
    'Happy': [
        'https://media.tenor.com/jLFLMOe6NLsAAAAC/happy-dance.gif',
        'https://media.tenor.com/OxDh69_zyJAAAAAC/celebrate.gif',
    ],
    'Sad': [],
    'Love': [
        'https://media.tenor.com/0AVbKGY_MigAAAAM/bear-heart.gif',
        'https://media.tenor.com/dVyfdJqEMu0AAAAC/heart-love.gif',
    ],
};

interface InCallChatSectionProps {
    channelId: string;
    currentUserId: string;
    friend: User;
    onClose: () => void;
}

export function InCallChatSection({ channelId, currentUserId, friend, onClose }: InCallChatSectionProps) {
    const {
        messages,
        hasMore,
        isLoading,
        isSending,
        replyingTo,
        typingUsers,
        fetchMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        setReplyingTo,
        clearReplyingTo
    } = useMessageStore();

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Picker states
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('Smileys');
    const [selectedGifCategory, setSelectedGifCategory] = useState('Trending');
    const [gifSearchQuery, setGifSearchQuery] = useState('');

    // Refs for click outside
    const attachmentMenuRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const gifPickerRef = useRef<HTMLDivElement>(null);

    // Fetch messages and subscribe to realtime
    useEffect(() => {
        if (channelId) {
            fetchMessages(channelId);
        }
    }, [channelId, fetchMessages]);

    useEffect(() => {
        if (!channelId) return;
        const unsubscribe = subscribeToMessages(channelId);
        return () => unsubscribe();
    }, [channelId]);

    // Close pickers when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
                setShowAttachmentMenu(false);
            }
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
                setShowGifPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSend = async () => {
        if (!inputValue.trim() || !channelId || !currentUserId) return;

        const content = inputValue;
        const replyToId = replyingTo?.$id;
        setInputValue('');
        clearReplyingTo();

        try {
            await sendMessage(channelId, currentUserId, content, replyToId);
        } catch {
            setInputValue(content);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEmojiClick = (emoji: string) => {
        setInputValue(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handleGifSelect = async (gifUrl: string) => {
        setShowGifPicker(false);
        if (!channelId || !currentUserId) return;
        await sendMessage(channelId, currentUserId, gifUrl);
    };

    const handleReaction = useCallback(async (message: Message, emoji: string) => {
        // TODO: Implement reactions
        console.log('React with', emoji, 'to message', message.$id);
    }, []);

    const handleReply = useCallback((message: Message) => {
        setReplyingTo(message);
    }, [setReplyingTo]);

    const handleEdit = useCallback((message: Message) => {
        setInputValue(message.content);
    }, []);

    const handleEditSave = useCallback(async (messageId: string, content: string) => {
        await editMessage(messageId, content);
    }, [editMessage]);

    const handleDelete = useCallback(async (message: Message) => {
        await deleteMessage(message.$id);
    }, [deleteMessage]);

    return (
        <div className="h-full flex flex-col bg-[#2b2d31]">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1f22] flex-shrink-0">
                <span className="text-sm font-medium text-white">Chat with {friend.displayName}</span>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <MessageList
                    messages={messages}
                    currentUserId={currentUserId}
                    friend={friend}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onEditSave={handleEditSave}
                    onDelete={handleDelete}
                    onReaction={handleReaction}
                    isLoading={isLoading}
                    hasMore={hasMore}
                />
                <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            <TypingIndicator usernames={Array.from(typingUsers.keys())} />

            {/* Reply Bar */}
            {replyingTo && (
                <ReplyBar
                    message={replyingTo}
                    currentUserId={currentUserId}
                    friend={friend}
                    onCancel={clearReplyingTo}
                />
            )}

            {/* Message Input Area */}
            <div className="p-3 border-t border-[#1e1f22] flex-shrink-0">
                <div className={`flex items-center gap-2 bg-[#383a40] px-3 ${replyingTo ? 'rounded-b-lg' : 'rounded-lg'}`}>
                    {/* Attachment Menu */}
                    <div className="relative" ref={attachmentMenuRef}>
                        <button
                            onClick={() => {
                                setShowAttachmentMenu(!showAttachmentMenu);
                                setShowEmojiPicker(false);
                                setShowGifPicker(false);
                            }}
                            className="text-gray-400 hover:text-white py-2"
                        >
                            <PlusCircle size={20} />
                        </button>

                        {showAttachmentMenu && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#2b2d31] rounded-lg shadow-lg border border-[#1e1f22] overflow-hidden z-50">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-white/10 transition-colors"
                                >
                                    <Image size={18} className="text-discord-primary" />
                                    <span className="text-sm">Upload File</span>
                                </button>
                                <button
                                    onClick={() => setShowAttachmentMenu(false)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-white/10 transition-colors"
                                >
                                    <Hash size={18} className="text-green-500" />
                                    <span className="text-sm">Create Thread</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                console.log('File selected:', file.name);
                                // TODO: Implement file upload
                            }
                        }}
                    />

                    {/* Message Input */}
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message @${friend.displayName}`}
                        className="flex-1 bg-transparent py-2.5 text-white placeholder:text-gray-500 focus:outline-none text-sm"
                        disabled={isSending}
                    />

                    <div className="flex items-center gap-1">
                        {/* Gift Button */}
                        <button
                            onClick={() => alert('Nitro Gift coming soon!')}
                            className="text-gray-400 hover:text-white p-1.5"
                            title="Send a gift"
                        >
                            <Gift size={18} />
                        </button>

                        {/* GIF Picker */}
                        <div className="relative" ref={gifPickerRef}>
                            <button
                                onClick={() => {
                                    setShowGifPicker(!showGifPicker);
                                    setShowEmojiPicker(false);
                                    setShowAttachmentMenu(false);
                                }}
                                className={`p-1.5 text-xs font-bold ${showGifPicker ? 'text-discord-primary' : 'text-gray-400 hover:text-white'}`}
                                title="GIFs"
                            >
                                GIF
                            </button>

                            {showGifPicker && (
                                <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#2b2d31] rounded-lg shadow-lg border border-[#1e1f22] z-50">
                                    {/* GIF Search */}
                                    <div className="p-2 border-b border-[#1e1f22]">
                                        <div className="flex items-center gap-2 bg-[#1e1f22] rounded px-2 py-1">
                                            <Search size={14} className="text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Search GIFs"
                                                value={gifSearchQuery}
                                                onChange={(e) => setGifSearchQuery(e.target.value)}
                                                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* GIF Categories */}
                                    <div className="flex gap-1 p-2 border-b border-[#1e1f22] overflow-x-auto">
                                        {GIF_CATEGORIES.map(category => (
                                            <button
                                                key={category}
                                                onClick={() => setSelectedGifCategory(category)}
                                                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${selectedGifCategory === category
                                                    ? 'bg-discord-primary text-white'
                                                    : 'text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>

                                    {/* GIF Grid */}
                                    <div className="grid grid-cols-2 gap-1 p-2 max-h-48 overflow-y-auto">
                                        {(SAMPLE_GIFS[selectedGifCategory] || []).map((gif, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleGifSelect(gif)}
                                                className="aspect-video overflow-hidden rounded hover:opacity-80"
                                            >
                                                <img src={gif} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Emoji Picker */}
                        <div className="relative" ref={emojiPickerRef}>
                            <button
                                onClick={() => {
                                    setShowEmojiPicker(!showEmojiPicker);
                                    setShowGifPicker(false);
                                    setShowAttachmentMenu(false);
                                }}
                                className={`p-1.5 ${showEmojiPicker ? 'text-discord-primary' : 'text-gray-400 hover:text-white'}`}
                                title="Emoji"
                            >
                                <Smile size={18} />
                            </button>

                            {showEmojiPicker && (
                                <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#2b2d31] rounded-lg shadow-lg border border-[#1e1f22] z-50">
                                    {/* Emoji Categories */}
                                    <div className="flex gap-1 p-2 border-b border-[#1e1f22] overflow-x-auto">
                                        {Object.keys(EMOJI_CATEGORIES).map(category => (
                                            <button
                                                key={category}
                                                onClick={() => setSelectedEmojiCategory(category)}
                                                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${selectedEmojiCategory === category
                                                    ? 'bg-discord-primary text-white'
                                                    : 'text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Emoji Grid */}
                                    <div className="grid grid-cols-8 gap-1 p-2 max-h-48 overflow-y-auto">
                                        {EMOJI_CATEGORIES[selectedEmojiCategory]?.map((emoji, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleEmojiClick(emoji)}
                                                className="text-xl hover:bg-white/10 rounded p-1"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isSending}
                            className="p-1.5 text-discord-primary hover:text-discord-primary/80 disabled:text-gray-500 disabled:cursor-not-allowed"
                        >
                            <SendHorizontal size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
