import { motion } from 'framer-motion';

interface TypingIndicatorProps {
    usernames: string[];
}

/**
 * Typing indicator with bouncing dots animation
 */
export function TypingIndicator({ usernames }: TypingIndicatorProps) {
    if (usernames.length === 0) return null;

    // Format the typing text
    let typingText: string;
    if (usernames.length === 1) {
        typingText = `${usernames[0]} is typing`;
    } else if (usernames.length === 2) {
        typingText = `${usernames[0]} and ${usernames[1]} are typing`;
    } else if (usernames.length === 3) {
        typingText = `${usernames[0]}, ${usernames[1]}, and ${usernames[2]} are typing`;
    } else {
        typingText = 'Several people are typing';
    }

    return (
        <div className="absolute bottom-full left-4 mb-1 flex items-center gap-1 text-xs text-text-muted">
            {/* Bouncing dots */}
            <div className="flex items-center gap-0.5">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="w-1.5 h-1.5 bg-text-muted rounded-full"
                        animate={{
                            y: [0, -4, 0],
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </div>

            {/* Typing text */}
            <span className="font-medium">{typingText}</span>
        </div>
    );
}
