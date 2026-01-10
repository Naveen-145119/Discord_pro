import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Providers
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ModalProvider } from '@/providers/modal-provider';

// Font configuration (Blueprint Section 4.1)
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Metadata for SEO
export const metadata: Metadata = {
  title: 'Discord Pro',
  description: 'A Discord clone built with Next.js 14',
  icons: {
    icon: '/favicon.ico',
  },
};

// Root Layout (Blueprint Section 4.1)
// Responsibilities: HTML/Body tags, Font injection, Global Providers
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <ModalProvider>
              {children}
            </ModalProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
