'use client'

import React from 'react';
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
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from "next-themes";

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

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-screen bg-background font-sans antialiased">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-border bg-muted/50 h-screen flex flex-col">
        {/* Logo and Theme Toggle */}
        <div className="p-4 flex items-center justify-between border-b border-border">
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
              onClick={() => router.push(item.path)}
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <User className="h-4 w-4" />
            Account
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 flex">
              <h1 className="text-xl font-bold">{title}</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="container py-6">
            {description && (
              <p className="text-muted-foreground mb-6">{description}</p>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PageTemplate;