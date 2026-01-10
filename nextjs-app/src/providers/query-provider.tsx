'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // How long data is considered fresh
                        staleTime: 1000 * 60, // 1 minute
                        // Don't refetch on window focus for better UX
                        refetchOnWindowFocus: false,
                        // Retry failed queries
                        retry: 1,
                    },
                    mutations: {
                        // Show errors in console for debugging
                        onError: (error) => {
                            console.error('Mutation error:', error);
                        },
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
