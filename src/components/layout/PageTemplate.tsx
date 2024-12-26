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
import { Navbar } from './Navbar'

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
  { label: 'Home', path: '/', icon: <Search className="h-4 w-4" /> },
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
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Main Content */}
      <div className="pt-14"> {/* Add padding-top to account for fixed navbar */}
        <main>
          {title && (
            <header className="border-b border-white/5">
              <div className="container py-4">
                <h1 className="text-2xl font-bold">{title}</h1>
                {description && (
                  <p className="text-muted-foreground mt-1">{description}</p>
                )}
              </div>
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageTemplate;






