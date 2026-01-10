'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        try {
            await login(email, password);
            router.push('/');
        } catch {
            // Error is handled by the store
        }
    };

    return (
        <div className="bg-[#313338] rounded-md p-8 shadow-lg">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#F2F3F5]">Welcome back!</h1>
                <p className="text-[#949BA4] mt-2">We&apos;re so excited to see you again!</p>
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
                        Email or Phone Number
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
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#949BA4] hover:text-[#DBDEE1]"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <button type="button" className="text-[#00AFF4] text-sm mt-1 hover:underline">
                        Forgot your password?
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full py-2.5 mt-2"
                >
                    {isLoading ? 'Logging in...' : 'Log In'}
                </button>
            </form>

            <p className="mt-4 text-sm text-[#949BA4]">
                Need an account?{' '}
                <Link href="/register" className="text-[#00AFF4] hover:underline">
                    Register
                </Link>
            </p>
        </div>
    );
}
