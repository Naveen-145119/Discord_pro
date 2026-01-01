import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        try {
            await login(email, password);
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
                        <h1 className="text-2xl font-bold text-text-heading">Welcome back!</h1>
                        <p className="text-text-muted mt-2">We're so excited to see you again!</p>
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
                                Email or Phone Number
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
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-normal"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button type="button" className="text-text-link text-sm mt-1 hover:underline">
                                Forgot your password?
                            </button>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full py-2.5 mt-2"
                        >
                            {isLoading ? 'Logging in...' : 'Log In'}
                        </button>
                    </form>

                    {/* Register link */}
                    <p className="mt-4 text-sm text-text-muted">
                        Need an account?{' '}
                        <Link to="/register" className="text-text-link hover:underline">
                            Register
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
