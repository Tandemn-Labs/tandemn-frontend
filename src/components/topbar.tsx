'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { Search, Code, User, LogOut, Settings, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopbarProps {
  onSearchFocus?: () => void;
}

export function Topbar({ onSearchFocus }: TopbarProps) {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();

  const navItems = [
    { href: '/models', label: 'Models' },
    { href: '/chat', label: 'Chat' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/metrics', label: 'Metrics' },
    { href: '/keys', label: 'API Keys' },
    { href: '/credits', label: 'Credits' },
    { href: '/settings', label: 'Settings' },
    { href: '/loadtest', label: 'Load Test' }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Code className="h-6 w-6" />
          <span className="font-bold">OpenRouter</span>
        </Link>

        {/* Search */}
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models... (⌘/)"
              className="pl-8"
              onFocus={onSearchFocus}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center space-x-6 ml-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.href
                  ? 'text-foreground'
                  : 'text-muted-foreground'
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
                  avatarBox: "h-8 w-8"
                }
              }}
            />
          ) : (
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
