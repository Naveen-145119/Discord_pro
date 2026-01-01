import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';

interface AddFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSendRequest: (username: string) => Promise<void>;
}

/**
 * Modal for adding friends by username
 */
export function AddFriendModal({ isOpen, onClose, onSendRequest }: AddFriendModalProps) {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            setError('Please enter a username');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await onSendRequest(trimmedUsername);
            setSuccess(`Friend request sent to ${trimmedUsername}!`);
            setUsername('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send friend request');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setUsername('');
        setError(null);
        setSuccess(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-background-primary rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-background-tertiary">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-text-heading">Add Friend</h2>
                        <button
                            onClick={handleClose}
                            className="p-1 rounded hover:bg-background-modifier-hover text-interactive-normal hover:text-interactive-hover transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-sm text-text-muted mt-1">
                        You can add friends with their Discord Pro username.
                    </p>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-text-normal uppercase mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter a username"
                            className="w-full px-3 py-2.5 bg-background-tertiary rounded-md text-text-normal placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-discord-primary"
                            autoFocus
                            disabled={isLoading}
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                            <p className="text-sm text-green-400">{success}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-text-normal hover:text-text-heading hover:underline transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !username.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-discord-primary hover:bg-discord-primary/90 disabled:bg-discord-primary/50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={16} />
                                    Send Request
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
