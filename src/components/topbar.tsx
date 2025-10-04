'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { Search, Menu, X, User, CreditCard, BarChart3, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopbarProps {
  onSearchFocus?: () => void;
}

export function Topbar({ onSearchFocus }: TopbarProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/chat', label: 'Playground' },
    { href: '/models', label: 'Models' },
    { href: '/batch-inference', label: 'Batch Inference' },
    { href: '/keys', label: 'API Keys' },
    // Combined Credits & Metrics into My Account dropdown
    // { href: '/credits', label: 'Credits' },
    // { href: '/metrics', label: 'Metrics' },
    // Settings page - commented out as requested
    // { href: '/settings', label: 'Settings' }
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 glass-card">
        <div className="container flex h-14 items-center justify-center">
          {/* Logo */}
          <Link href="https://www.tandemn.com" className="flex items-center space-x-3 group">
            <img src="/cute-logo-1.png" alt="Tandemn" className="h-8 w-8 gentle-float" />
            <span className="font-bold text-lg gradient-text">Tandemn</span>
          </Link>

          {/* Search - Hidden on mobile */}
          {/* <div className="flex flex-1 items-center space-x-2 hidden md:flex">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                className="pl-9 h-9 bg-background/80 border-border"
                onFocus={onSearchFocus}
              />
            </div>
          </div> */}

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 ml-8">
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
            
            {/* My Account Dropdown */}
            {isSignedIn && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/5">
                    <User className="h-4 w-4 mr-2" />
                    My Account
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/credits" className="flex items-center w-full">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Credits & Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/metrics" className="flex items-center w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Usage Metrics
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* User Menu - Desktop (Positioned absolutely to avoid affecting centering) */}
          <div className="absolute right-4 hidden md:block">
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

          {/* Mobile Menu Button */}
          <div className="absolute right-4 flex items-center space-x-2 md:hidden">
            {isSignedIn && (
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 rounded-full"
                  }
                }}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="h-9 w-9"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-14 z-40 md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-background border-b shadow-lg">
            {/* Mobile Search */}
            {/* <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search models..."
                  className="pl-9 h-9 bg-background/80 border-border"
                  onFocus={() => {
                    onSearchFocus?.();
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>
            </div> */}

            {/* Mobile Navigation */}
            <nav className="px-4 pt-8 pb-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile My Account Section */}
              {isSignedIn && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    My Account
                  </div>
                  <Link
                    href="/credits"
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      pathname === '/credits'
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <CreditCard className="h-4 w-4 mr-3" />
                    Credits & Billing
                  </Link>
                  <Link
                    href="/metrics"
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      pathname === '/metrics'
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <BarChart3 className="h-4 w-4 mr-3" />
                    Usage Metrics
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile Sign In */}
            {!isSignedIn && (
              <div className="p-4 border-t">
                <SignInButton mode="modal">
                  <Button className="w-full modern-button" onClick={() => setIsMobileMenuOpen(false)}>
                    Sign In
                  </Button>
                </SignInButton>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
