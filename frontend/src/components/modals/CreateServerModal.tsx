import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';

interface CreateServerModalProps {
    onClose: () => void;
}

export function CreateServerModal({ onClose }: CreateServerModalProps) {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { createServer, isLoading, error } = useServerStore();

    const [serverName, setServerName] = useState(`${user?.displayName || 'My'}'s server`);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.$id || !serverName.trim()) return;

        try {
            const server = await createServer(serverName.trim(), user.$id);
            onClose();
            navigate(`/servers/${server.$id}`);
        } catch {
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/80"
                onClick={onClose}
            />

            <div className="relative bg-background-primary rounded-md shadow-elevation-high w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-interactive-normal hover:text-interactive-hover"
                >
                    <X size={24} />
                </button>

                <div className="pt-6 px-6 text-center">
                    <h2 className="text-2xl font-bold text-text-heading">Customize your server</h2>
                    <p className="text-text-muted mt-2 text-sm">
                        Give your new server a personality with a name and an icon. You can always change it later.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex justify-center">
                        <button
                            type="button"
                            className="w-20 h-20 rounded-full border-2 border-dashed border-interactive-muted flex flex-col items-center justify-center gap-1 hover:border-interactive-normal transition-colors"
                        >
                            <Upload size={24} className="text-interactive-muted" />
                            <span className="text-xs text-interactive-muted uppercase font-bold">Upload</span>
                        </button>
                    </div>

                    <div>
                        <label
                            htmlFor="serverName"
                            className="block text-xs font-bold text-text-muted uppercase mb-2"
                        >
                            Server Name
                        </label>
                        <input
                            id="serverName"
                            type="text"
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                            className="input-field w-full"
                            required
                            maxLength={100}
                        />
                    </div>

                    {error && (
                        <p className="text-discord-red text-sm">{error}</p>
                    )}

                    <p className="text-xs text-text-muted">
                        By creating a server, you agree to Discord's{' '}
                        <span className="text-text-link">Community Guidelines</span>.
                    </p>

                    <div className="flex justify-between pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-link text-text-normal"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !serverName.trim()}
                            className="btn-primary"
                        >
                            {isLoading ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
