'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        try {
            await register(email, password, username);
            router.push('/');
        } catch {
            // Error is handled by the store
        }
    };

    return (
        <div className="bg-[#313338] rounded-md p-8 shadow-lg">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#F2F3F5]">Create an account</h1>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-[#ED4245]/10 border border-[#ED4245]/50 rounded-md">
                    <p className="text-[#ED4245] text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="email"
                        className="block text-xs font-bold text-[#949BA4] uppercase mb-2"
                    >
                        Email
                        <span className="text-[#ED4245] ml-1">*</span>
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

                <div>
                    <label
                        htmlFor="username"
                        className="block text-xs font-bold text-[#949BA4] uppercase mb-2"
                    >
                        Username
                        <span className="text-[#ED4245] ml-1">*</span>
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field w-full"
                        required
                        autoComplete="username"
                        minLength={2}
                        maxLength={32}
                    />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="block text-xs font-bold text-[#949BA4] uppercase mb-2"
                    >
                        Password
                        <span className="text-[#ED4245] ml-1">*</span>
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field w-full pr-10"
                            required
                            autoComplete="new-password"
                            minLength={8}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#949BA4] hover:text-[#DBDEE1]"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full py-2.5 mt-2"
                >
                    {isLoading ? 'Creating account...' : 'Continue'}
                </button>
            </form>

            <p className="mt-4 text-sm text-[#949BA4]">
                Already have an account?{' '}
                <Link href="/login" className="text-[#00AFF4] hover:underline">
                    Log In
                </Link>
            </p>
        </div>
    );
}
