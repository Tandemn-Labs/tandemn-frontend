import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '@/components/providers';
import { Topbar } from '@/components/topbar';
import '@/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tandemn - Combining Heterogenous GPUs to run AI models',
  description: 'vRAM goes BRRRR',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          // Hide the development mode footer
          footer: "hidden",
          // Hide development badge in UserButton dropdown
          userButtonPopoverFooter: "hidden",
          // Hide the Clerk branding in user button
          userButtonPopoverActionButton__manageAccount: {
            display: "block"
          },
          userButtonPopoverActionButton__signOut: {
            display: "block"
          }
        },
        layout: {
          // Remove development badge from all Clerk components
          unsafe_disableDevelopmentModeWarnings: true
        }
      }}
      afterSignOutUrl="/sign-in"
    >
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
