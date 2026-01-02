import { Phone, Video, X } from 'lucide-react';
import type { ActiveCall } from '@/hooks/useCall';

interface IncomingCallModalProps {
    call: ActiveCall;
    onAnswer: () => void;
    onDecline: () => void;
}

export function IncomingCallModal({ call, onAnswer, onDecline }: IncomingCallModalProps) {
    const callerName = call.caller?.displayName || 'Unknown';
    const isVideoCall = call.callType === 'video';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <div className="bg-background-secondary rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-pulse-slow">
                <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 rounded-full bg-discord-primary flex items-center justify-center ring-4 ring-green-500/50 animate-ping-slow">
                        {call.caller?.avatarUrl ? (
                            <img
                                src={call.caller.avatarUrl}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="text-4xl font-bold text-white">
                                {callerName.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-4 border-background-secondary">
                        {isVideoCall ? (
                            <Video size={14} className="text-white" />
                        ) : (
                            <Phone size={14} className="text-white" />
                        )}
                    </div>
                </div>

                <h2 className="text-xl font-bold text-text-heading mb-1">
                    {callerName}
                </h2>
                <p className="text-text-muted mb-6">
                    Incoming {isVideoCall ? 'Video' : 'Voice'} Call...
                </p>

                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={onDecline}
                        className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all hover:scale-110 shadow-lg"
                        title="Decline"
                    >
                        <X size={28} />
                    </button>

                    <button
                        onClick={onAnswer}
                        className="p-4 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all hover:scale-110 shadow-lg animate-bounce"
                        title="Answer"
                    >
                        {isVideoCall ? (
                            <Video size={28} />
                        ) : (
                            <Phone size={28} />
                        )}
                    </button>
                </div>

                <p className="text-xs text-text-muted mt-6 animate-pulse">
                    🔔 Ringing...
                </p>
            </div>

            <style>{`
                @keyframes ping-slow {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
                .animate-ping-slow {
                    animation: ping-slow 1.5s ease-in-out infinite;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.9; }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
