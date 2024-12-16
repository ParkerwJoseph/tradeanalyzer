'use client'

import React, { useState, useEffect } from 'react';
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
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from "next-themes";
import { cn } from '@/lib/utils';
import { auth, database } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import { getConversations } from '@/lib/userStore';
import Cookies from 'js-cookie';

interface PageTemplateProps {
  children?: React.ReactNode;
  title: string;
  description?: string;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: number;
  messages: any[];
}
interface Conversation {
  createdAt: number;
  title: string;
  messages: any[];
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user] = useAuthState(auth);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});

  React.useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadConversations = async () => {
      const uid = Cookies.get('uid');
      if (uid) {
        const convos = await getConversations(uid);
        setConversations(convos);
      }
    };
    loadConversations();
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
          <div className="font-semibold text-lg">StocX</div>
          <ThemeToggle />
        </div>
      </header>

      {/* Sidebar - Desktop and Mobile */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 border-r border-border bg-muted/50 transform transition-all duration-200 ease-in-out md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:transform-none",
        isCollapsed ? "w-12" : "w-64"
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

        {/* Main sidebar content wrapper */}
        <div className="flex flex-col h-full">
          {/* Logo and Theme Toggle - Desktop Only */}
          <div className="hidden md:flex p-4 items-center justify-between border-b border-border">
            <div className={cn("font-semibold text-lg transition-opacity", 
              isCollapsed ? "opacity-0" : "opacity-100"
            )}>
              StocX
            </div>
            <div className="flex items-center gap-2">
              {mounted && !isCollapsed && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? 
                  <ChevronRight className="h-4 w-4" /> : 
                  <ChevronLeft className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>

          {/* New Thread Button */}
          <div className="p-4">
            <Button 
              variant="outline" 
              className={cn(
                "justify-start gap-2",
                isCollapsed ? "w-6 px-1" : "w-full"
              )}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Plus className="h-4 w-4" />
              {!isCollapsed && "New Thread"}
            </Button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Home section with nested chat history */}
            <div className="space-y-1">
                <Button
                    variant="ghost"
                    className={cn(
                        "justify-start gap-2 w-full",
                        isCollapsed ? "w-6 px-1" : "w-full"
                    )}
                    onClick={() => handleNavigation('/components/stock-gpt')}
                >
                    <Search className="h-4 w-4" />
                    {!isCollapsed && "Home"}
                </Button>
                
                {!isCollapsed && pathname.includes('/components/stock-gpt') && (
                    <div className="ml-4 space-y-1">
                         {Object.entries(conversations)
                          .sort((a, b) => (b[1] as Conversation).createdAt - (a[1] as Conversation).createdAt)
                          .slice(0, 4)
                          .map(([id, convo]) => (
                            <Button
                                key={id}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "w-full justify-start text-sm text-muted-foreground hover:text-foreground",
                                    pathname === `/components/stock-gpt?chat=${id}` && "text-foreground"
                                )}
                                onClick={() => {
                                    handleNavigation(`/components/stock-gpt?chat=${id}`);
                                }}
                            >
                                <div className="truncate">
                                    {convo.title}
                                </div>
                            </Button>
                          ))}
                    </div>
                )}
            </div>

            {/* Other navigation items */}
            {sidebarItems.slice(1).map((item) => (
                <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(
                        "justify-start gap-2",
                        isCollapsed ? "w-6 px-1" : "w-full"
                    )}
                    onClick={() => handleNavigation(item.path)}
                >
                    {item.icon}
                    {!isCollapsed && item.label}
                </Button>
            ))}
          </div>

          {/* Bottom Section */}
          <div className="mt-auto space-y-2">
            {/* Auth Buttons or Profile Section */}
            <div className="px-4">
              {user ? (
                // If user is logged in, show nothing here (profile section is below)
                null
              ) : (
                <div className={cn("space-y-2", isCollapsed && "space-y-4")}>
                  <Button
                    variant="default"
                    className={cn(
                      "justify-start gap-2",
                      isCollapsed ? "w-6 px-1" : "w-full"
                    )}
                    onClick={() => handleNavigation('/auth/signin')}
                  >
                    {isCollapsed ? (
                      <User className="h-4 w-4" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                  {!isCollapsed && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleNavigation('/auth/signup')}
                    >
                      Sign Up
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Profile Section - Only show if user exists */}
            {!isCollapsed && user && (
              <div 
                className="p-4 border-t border-border cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleNavigation('/components/account')}
              >
                <div className="flex items-center space-x-3">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col",
        isCollapsed ? "md:ml-12" : "md:ml-0"
      )}>
        {/* Desktop Header */}
        <header className="">
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






