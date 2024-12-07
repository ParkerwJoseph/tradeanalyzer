'use client'

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  BellIcon,
  Settings,
  User,
  Compass,
  Library,
  BookmarkIcon,
  Search,
  Plus,
  Moon,
  Sun,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from "next-themes";
import { cn } from '@/lib/utils';

interface PageTemplateProps {
  children?: React.ReactNode;
  title: string;
  description?: string;
}

const sidebarItems = [
  { label: 'Home', path: '/components/stock-gpt', icon: <Search className="h-4 w-4" /> },
  { label: 'Discover', path: '/components/discover', icon: <Compass className="h-4 w-4" /> },
  { label: 'Library', path: '/components/library', icon: <Library className="h-4 w-4" /> },
  { label: 'Watchlist', path: '/components/watchlist', icon: <BookmarkIcon className="h-4 w-4" /> }
];

const PageTemplate = ({ children, title, description }: PageTemplateProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-background font-sans antialiased">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 md:hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="font-semibold">StockGPT</div>
          {mounted && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Sidebar - Desktop and Mobile */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 border-r border-border bg-muted/50 transform transition-transform duration-200 ease-in-out md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:transform-none"
      )}>
        {/* Close button for mobile */}
        <div className="md:hidden p-4 flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Logo and Theme Toggle - Desktop Only */}
        <div className="hidden md:flex p-4 items-center justify-between border-b border-border">
          <div className="font-semibold text-lg">StockGPT</div>
          {mounted && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* New Thread Button */}
        <div className="p-4">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => setIsSidebarOpen(false)}
          >
            <Plus className="h-4 w-4" />
            New Thread
          </Button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sidebarItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => handleNavigation(item.path)}
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2"
            onClick={() => setIsSidebarOpen(false)}
          >
            <User className="h-4 w-4" />
            Account
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Desktop Header */}
        <header className="hidden md:block sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 flex">
              <h1 className="text-xl font-bold">{title}</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="container py-6">
            {description && (
              <p className="text-muted-foreground mb-6">{description}</p>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default PageTemplate;