import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '@/components/providers';
import { Topbar } from '@/components/topbar';
import '@/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OpenRouter Clone',
  description: 'The unified interface for LLMs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers>
            <div className="relative flex min-h-screen flex-col">
              <Topbar />
              <main className="flex-1">{children}</main>
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
