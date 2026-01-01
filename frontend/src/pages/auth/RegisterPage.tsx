import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        // Basic validation
        if (username.length < 2 || username.length > 32) {
            return;
        }

        if (password.length < 8) {
            return;
        }

        try {
            await register(email, password, username);
            navigate('/');
        } catch {
            // Error is handled by store
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-tertiary p-4">
            <div className="w-full max-w-md">
                <div className="bg-background-primary rounded-md p-8 shadow-elevation-high">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-text-heading">Create an account</h1>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 bg-discord-red/10 border border-discord-red/50 rounded-md">
                            <p className="text-discord-red text-sm">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-xs font-bold text-text-muted uppercase mb-2"
                            >
                                Email
                                <span className="text-discord-red ml-1">*</span>
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field w-full"
                                required
                                autoComplete="email"
                            />
                        </div>

                        {/* Username */}
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-xs font-bold text-text-muted uppercase mb-2"
                            >
                                Display Name
                                <span className="text-discord-red ml-1">*</span>
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-field w-full"
                                required
                                minLength={2}
                                maxLength={32}
                                autoComplete="username"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-xs font-bold text-text-muted uppercase mb-2"
                            >
                                Password
                                <span className="text-discord-red ml-1">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field w-full pr-10"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-normal"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-text-muted mt-1">
                                Must be at least 8 characters
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full py-2.5 mt-2"
                        >
                            {isLoading ? 'Creating account...' : 'Continue'}
                        </button>

                        {/* Terms */}
                        <p className="text-xs text-text-muted">
                            By registering, you agree to Discord's{' '}
                            <span className="text-text-link hover:underline cursor-pointer">
                                Terms of Service
                            </span>{' '}
                            and{' '}
                            <span className="text-text-link hover:underline cursor-pointer">
                                Privacy Policy
                            </span>
                            .
                        </p>
                    </form>

                    {/* Login link */}
                    <p className="mt-4 text-sm">
                        <Link to="/login" className="text-text-link hover:underline">
                            Already have an account?
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
