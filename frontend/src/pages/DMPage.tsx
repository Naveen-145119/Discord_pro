import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Phone,
    Video,
    MoreVertical,
    PlusCircle,
    Gift,
    Smile,
    SendHorizontal,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    PhoneOff,
    Image,
    FileText,
    Hash,
    X,
    Search
} from 'lucide-react';
import { useMessageStore, subscribeToMessages } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useDMs } from '@/hooks/useDMs';
import { useCallContext } from '@/providers/CallProvider';
import { formatMessageTime } from '@/lib/utils';
import type { Message as MessageType, User, CallLogMetadata } from '@/types';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';

// Common emojis organized by category
const EMOJI_CATEGORIES = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
    'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '👄'],
    'Objects': ['🎮', '🎲', '🎯', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '📱', '💻', '🖥️', '⌨️', '🖨️', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳'],
    'Symbols': ['✅', '❌', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '💠', '🔘', '🔲', '🔳', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄']
};

// GIF categories for browsing
const GIF_CATEGORIES = ['Trending', 'Reactions', 'Happy', 'Sad', 'Angry', 'Love', 'Wow', 'Dance', 'Gaming', 'Anime'];

// Sample GIF URLs (in production, use Tenor/Giphy API)
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
    'Love': [
        'https://media.tenor.com/0AVbKGY_MigAAAAM/bear-heart.gif',
        'https://media.tenor.com/dVyfdJqEMu0AAAAC/heart-love.gif',
    ],
};

export function DMPage() {
    const { channelId } = useParams<{ channelId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { dmChannels } = useDMs();
    const { startCall: startGlobalCall } = useCallContext();
    const {
        messages,
        hasMore,
        isLoading,
        isSending,
        fetchMessages,
        sendMessage,
        clearMessages
    } = useMessageStore();

    const [inputValue, setInputValue] = useState('');
    const [friend, setFriend] = useState<User | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Picker states
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('Smileys');
    const [selectedGifCategory, setSelectedGifCategory] = useState('Trending');
    const [gifSearchQuery, setGifSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);

    // Close pickers when clicking outside
    const attachmentMenuRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const gifPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
                setShowAttachmentMenu(false);
            }
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (gifPickerRef.current && !gifPickerRef.current.contains(event.target as Node)) {
                setShowGifPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle emoji selection
    const handleEmojiSelect = useCallback((emoji: string) => {
        setInputValue(prev => prev + emoji);
        setShowEmojiPicker(false);
    }, []);

    // Handle GIF selection
    const handleGifSelect = useCallback(async (gifUrl: string) => {
        if (!channelId || !user?.$id) return;
        
        try {
            // Send the GIF URL as a message
            await sendMessage(channelId, user.$id, gifUrl);
            setShowGifPicker(false);
        } catch (err) {
            console.error('Failed to send GIF:', err);
        }
    }, [channelId, user?.$id, sendMessage]);

    // Handle file selection
    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            
            // Create preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setFilePreview(e.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
        }
        setShowAttachmentMenu(false);
    }, []);

    // Clear file selection
    const clearFileSelection = useCallback(() => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    useEffect(() => {
        const dmChannel = dmChannels.find(dm => dm.$id === channelId);
        if (dmChannel) {
            setFriend(dmChannel.friend);
        } else if (channelId) {
            const fetchDMDetails = async () => {
                try {
                    const dm = await databases.getDocument(DATABASE_ID, COLLECTIONS.DM_CHANNELS, channelId);
                    const participants = typeof dm.participantIds === 'string'
                        ? JSON.parse(dm.participantIds)
                        : dm.participantIds;
                    const friendId = participants.find((id: string) => id !== user?.$id);
                    if (friendId) {
                        const friendDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.USERS, friendId);
                        setFriend(friendDoc as unknown as User);
                    }
                } catch (err) {
                    console.error('Error fetching DM details:', err);
                }
            };
            fetchDMDetails();
        }
    }, [channelId, dmChannels, user?.$id]);

    useEffect(() => {
        if (channelId) {
            fetchMessages(channelId);
        }

        return () => {
            clearMessages();
        };
    }, [channelId, fetchMessages, clearMessages]);

    useEffect(() => {
        if (!channelId) return;

        const unsubscribe = subscribeToMessages(channelId);
        return () => {
            unsubscribe();
        };
    }, [channelId]);

    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]);

    const handleSend = async () => {
        if (!inputValue.trim() || !channelId || !user?.$id) return;

        const content = inputValue;
        setInputValue('');

        try {
            await sendMessage(channelId, user.$id, content);
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

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container || isLoading || !hasMore) return;

        if (container.scrollTop === 0 && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            fetchMessages(channelId!, lastMessage.$id);
        }
    };

    const handleStartCall = (type: 'voice' | 'video') => {
        if (!channelId || !friend) return;
        startGlobalCall(friend.$id, channelId, type, friend);
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-status-online';
            case 'idle': return 'bg-status-idle';
            case 'dnd': return 'bg-status-dnd';
            default: return 'bg-status-offline';
        }
    };

    if (!friend) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-discord-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background-primary">
            <div className="h-12 px-4 flex items-center justify-between border-b border-background-tertiary shadow-elevation-low">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="text-interactive-normal hover:text-interactive-hover md:hidden"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-discord-primary flex items-center justify-center">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-sm font-medium text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background-primary ${getStatusColor(friend.status)}`} />
                    </div>

                    <div>
                        <span className="font-semibold text-text-heading">
                            {friend.displayName}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleStartCall('voice')}
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="Start Voice Call"
                    >
                        <Phone size={20} />
                    </button>
                    <button
                        onClick={() => handleStartCall('video')}
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="Start Video Call"
                    >
                        <Video size={20} />
                    </button>
                    <button
                        className="p-2 text-interactive-normal hover:text-interactive-hover hover:bg-background-modifier-hover rounded-md transition-colors"
                        title="More Options"
                    >
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto flex flex-col-reverse"
            >
                <div ref={messagesEndRef} />

                {messages.length === 0 && !isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="w-20 h-20 rounded-full bg-discord-primary flex items-center justify-center mb-4">
                            {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-2xl font-medium text-white">
                                    {friend.displayName?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-bold text-text-heading mb-2">
                            {friend.displayName}
                        </h3>
                        <p className="text-text-muted text-center max-w-md mb-4">
                            This is the beginning of your direct message history with <strong>{friend.displayName}</strong>.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleStartCall('voice')}
                                className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-modifier-hover rounded-md text-text-normal transition-colors"
                            >
                                <Phone size={16} />
                                Voice Call
                            </button>
                            <button
                                onClick={() => handleStartCall('video')}
                                className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-modifier-hover rounded-md text-text-normal transition-colors"
                            >
                                <Video size={16} />
                                Video Call
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        {isLoading && (
                            <div className="flex justify-center py-4">
                                <div className="w-6 h-6 border-2 border-discord-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}

                        {[...messages].reverse().map((message) => (
                            <DMMessageItem
                                key={message.$id}
                                message={message}
                                friend={friend}
                                currentUserId={user?.$id || ''}
                                onStartCall={handleStartCall}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="px-4 pb-6 relative">
                {/* Hidden file input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                />

                {/* File preview */}
                {selectedFile && (
                    <div className="mb-2 p-3 bg-background-secondary rounded-lg">
                        <div className="flex items-start gap-3">
                            {filePreview ? (
                                <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded" />
                            ) : (
                                <div className="w-20 h-20 bg-background-tertiary rounded flex items-center justify-center">
                                    <FileText size={32} className="text-text-muted" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-text-normal font-medium truncate">{selectedFile.name}</p>
                                <p className="text-xs text-text-muted">
                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                            <button
                                onClick={clearFileSelection}
                                className="p-1 text-text-muted hover:text-text-normal hover:bg-background-modifier-hover rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 bg-background-tertiary rounded-lg px-4 relative">
                    {/* Attachment Menu */}
                    <div className="relative" ref={attachmentMenuRef}>
                        <button
                            onClick={() => {
                                setShowAttachmentMenu(!showAttachmentMenu);
                                setShowEmojiPicker(false);
                                setShowGifPicker(false);
                            }}
                            className="text-interactive-normal hover:text-interactive-hover py-2.5"
                        >
                            <PlusCircle size={20} />
                        </button>

                        {showAttachmentMenu && (
                            <div className="absolute bottom-full left-0 mb-2 w-56 bg-background-floating rounded-lg shadow-lg border border-background-tertiary overflow-hidden z-50">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-text-normal hover:bg-background-modifier-hover transition-colors"
                                >
                                    <Image size={20} className="text-discord-primary" />
                                    <span>Upload a File</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAttachmentMenu(false);
                                        // You can add more functionality here
                                        alert('Create Thread feature coming soon!');
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-text-normal hover:bg-background-modifier-hover transition-colors"
                                >
                                    <Hash size={20} className="text-green-500" />
                                    <span>Create Thread</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message @${friend.displayName}`}
                        className="flex-1 bg-transparent py-2.5 text-text-normal placeholder:text-text-muted focus:outline-none"
                        disabled={isSending}
                    />

                    <div className="flex items-center gap-1">
                        {/* Gift Button */}
                        <button
                            onClick={() => alert('Nitro Gift feature coming soon!')}
                            className="text-interactive-normal hover:text-interactive-hover p-1.5"
                            title="Send a gift"
                        >
                            <Gift size={20} />
                        </button>

                        {/* GIF Picker */}
                        <div className="relative" ref={gifPickerRef}>
                            <button
                                onClick={() => {
                                    setShowGifPicker(!showGifPicker);
                                    setShowEmojiPicker(false);
                                    setShowAttachmentMenu(false);
                                }}
                                className={`p-1.5 rounded transition-colors ${
                                    showGifPicker 
                                        ? 'text-discord-primary bg-background-modifier-hover' 
                                        : 'text-interactive-normal hover:text-interactive-hover'
                                }`}
                                title="GIF"
                            >
                                <span className="text-xs font-bold">GIF</span>
                            </button>

                            {showGifPicker && (
                                <div className="absolute bottom-full right-0 mb-2 w-96 h-96 bg-background-floating rounded-lg shadow-lg border border-background-tertiary overflow-hidden z-50">
                                    <div className="p-3 border-b border-background-tertiary">
                                        <div className="flex items-center gap-2 bg-background-secondary rounded px-3 py-2">
                                            <Search size={16} className="text-text-muted" />
                                            <input
                                                type="text"
                                                placeholder="Search Tenor"
                                                value={gifSearchQuery}
                                                onChange={(e) => setGifSearchQuery(e.target.value)}
                                                className="flex-1 bg-transparent text-sm text-text-normal placeholder:text-text-muted focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex border-b border-background-tertiary overflow-x-auto">
                                        {GIF_CATEGORIES.map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedGifCategory(cat)}
                                                className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                                                    selectedGifCategory === cat
                                                        ? 'text-white border-b-2 border-discord-primary'
                                                        : 'text-text-muted hover:text-text-normal'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-2 h-64 overflow-y-auto">
                                        <div className="grid grid-cols-2 gap-2">
                                            {(SAMPLE_GIFS[selectedGifCategory] || SAMPLE_GIFS['Trending']).map((gifUrl, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleGifSelect(gifUrl)}
                                                    className="aspect-video bg-background-secondary rounded overflow-hidden hover:ring-2 hover:ring-discord-primary transition-all"
                                                >
                                                    <img
                                                        src={gifUrl}
                                                        alt="GIF"
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </button>
                                            ))}
                                            {/* Placeholder for more GIFs */}
                                            <div className="col-span-2 py-4 text-center text-text-muted text-sm">
                                                Powered by Tenor
                                            </div>
                                        </div>
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
                                className={`p-1.5 rounded transition-colors ${
                                    showEmojiPicker 
                                        ? 'text-discord-primary bg-background-modifier-hover' 
                                        : 'text-interactive-normal hover:text-interactive-hover'
                                }`}
                                title="Emoji"
                            >
                                <Smile size={20} />
                            </button>

                            {showEmojiPicker && (
                                <div className="absolute bottom-full right-0 mb-2 w-80 h-96 bg-background-floating rounded-lg shadow-lg border border-background-tertiary overflow-hidden z-50">
                                    <div className="p-2 border-b border-background-tertiary">
                                        <div className="flex items-center gap-2 bg-background-secondary rounded px-3 py-2">
                                            <Search size={16} className="text-text-muted" />
                                            <input
                                                type="text"
                                                placeholder="Search emoji"
                                                className="flex-1 bg-transparent text-sm text-text-normal placeholder:text-text-muted focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex border-b border-background-tertiary overflow-x-auto px-2">
                                        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedEmojiCategory(cat)}
                                                className={`p-2 text-lg transition-colors ${
                                                    selectedEmojiCategory === cat
                                                        ? 'bg-background-modifier-hover rounded'
                                                        : 'hover:bg-background-modifier-hover rounded'
                                                }`}
                                                title={cat}
                                            >
                                                {EMOJI_CATEGORIES[cat as keyof typeof EMOJI_CATEGORIES][0]}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-2 h-64 overflow-y-auto">
                                        <p className="text-xs text-text-muted font-semibold mb-2 px-1">{selectedEmojiCategory}</p>
                                        <div className="grid grid-cols-8 gap-1">
                                            {EMOJI_CATEGORIES[selectedEmojiCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleEmojiSelect(emoji)}
                                                    className="p-1 text-xl hover:bg-background-modifier-hover rounded transition-colors"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(inputValue.trim() || selectedFile) && (
                            <button
                                onClick={handleSend}
                                disabled={isSending}
                                className="text-discord-primary hover:text-discord-primary/80 p-1.5 disabled:opacity-50"
                            >
                                <SendHorizontal size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DMMessageItem({
    message,
    friend,
    currentUserId,
    onStartCall
}: {
    message: MessageType;
    friend: User;
    currentUserId: string;
    onStartCall?: (type: 'voice' | 'video') => void;
}) {
    const isOwnMessage = message.authorId === currentUserId;
    const displayUser = isOwnMessage ? null : friend;

    // Handle call log messages
    if (message.type === 'call') {
        let callMetadata: CallLogMetadata | null = null;
        try {
            if (message.metadata) {
                callMetadata = JSON.parse(message.metadata) as CallLogMetadata;
            }
        } catch {
            // Invalid metadata
        }

        if (!callMetadata) return null;

        const isOutgoing = callMetadata.callerId === currentUserId;
        const isVideoCall = callMetadata.callType === 'video';
        
        // Format duration
        const formatDuration = (seconds?: number) => {
            if (!seconds) return '';
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            if (hrs > 0) {
                return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Determine call status display
        let CallIcon = Phone;
        let iconColor = 'text-green-500';
        let statusText = '';
        let statusColor = 'text-text-muted';

        switch (callMetadata.callStatus) {
            case 'ended':
                CallIcon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
                iconColor = 'text-green-500';
                statusText = isOutgoing ? 'Outgoing call' : 'Incoming call';
                if (callMetadata.duration) {
                    statusText += ` • ${formatDuration(callMetadata.duration)}`;
                }
                break;
            case 'missed':
                CallIcon = PhoneMissed;
                iconColor = 'text-red-500';
                statusText = isOutgoing ? 'Call not answered' : 'Missed call';
                statusColor = 'text-red-400';
                break;
            case 'declined':
                CallIcon = PhoneOff;
                iconColor = 'text-red-500';
                statusText = isOutgoing ? 'Call declined' : 'You declined';
                statusColor = 'text-red-400';
                break;
            default:
                statusText = 'Call';
        }

        return (
            <div className="message-container group">
                <div className={`w-10 h-10 mt-0.5 flex-shrink-0 rounded-full flex items-center justify-center ${
                    callMetadata.callStatus === 'ended' ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                    <CallIcon size={20} className={iconColor} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-text-heading">
                            {isVideoCall ? 'Video Call' : 'Voice Call'}
                        </span>
                        <span className={`text-sm ${statusColor}`}>
                            {statusText}
                        </span>
                        <span className="text-xs text-text-muted">
                            {formatMessageTime(message.$createdAt)}
                        </span>
                    </div>
                    
                    {/* Call back button */}
                    {onStartCall && (
                        <button
                            onClick={() => onStartCall(callMetadata.callType)}
                            className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-background-secondary hover:bg-background-modifier-hover rounded text-sm text-text-normal transition-colors"
                        >
                            {isVideoCall ? <Video size={14} /> : <Phone size={14} />}
                            Call Back
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Regular message
    return (
        <div className="message-container group">
            <div className="avatar w-10 h-10 mt-0.5 flex-shrink-0 bg-discord-primary">
                {displayUser?.avatarUrl ? (
                    <img src={displayUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                    <span className="text-sm font-medium text-white">
                        {isOwnMessage ? 'Y' : friend.displayName?.charAt(0) || '?'}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="font-medium text-text-heading hover:underline cursor-pointer">
                        {isOwnMessage ? 'You' : friend.displayName}
                    </span>
                    <span className="text-xs text-text-muted">
                        {formatMessageTime(message.$createdAt)}
                    </span>
                    {message.isEdited && (
                        <span className="text-xs text-text-muted">(edited)</span>
                    )}
                </div>
                <p className="text-text-normal whitespace-pre-wrap break-words">
                    {message.content}
                </p>
            </div>
        </div>
    );
}
