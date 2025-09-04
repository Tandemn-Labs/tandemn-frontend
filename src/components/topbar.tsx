'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TopbarProps {
  onSearchFocus?: () => void;
}

export function Topbar({ onSearchFocus }: TopbarProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  const navItems = [
    { href: '/chat', label: 'Chat' },
<<<<<<< Updated upstream
    { href: '/rankings', label: 'Rankings' },
    { href: '/metrics', label: 'Metrics' },
=======
>>>>>>> Stashed changes
    { href: '/keys', label: 'API Keys' },
    { href: '/credits', label: 'Credits' },
    { href: '/settings', label: 'Settings' }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 glass-card">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="mr-8 flex items-center space-x-3 group">
          <img src="/tandemn-logo-circle.svg" alt="Tandemn" className="h-8 w-8 gentle-float" />
          <span className="font-bold text-lg gradient-text">Tandemn</span>
        </Link>

        {/* Search */}
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              className="pl-9 h-9 bg-background/80 border-border"
              onFocus={onSearchFocus}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center space-x-1 ml-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                pathname === item.href
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="ml-6">
          {isSignedIn ? (
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 rounded-full"
                }
              }}
            />
          ) : (
            <SignInButton mode="modal">
              <Button className="modern-button">
                Sign In
              </Button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
