'use client'

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  BellIcon,
  Settings,
  User
} from 'lucide-react';
import Link from 'next/link';

interface PageTemplateProps {
  children?: React.ReactNode;
  title: string;
  description?: string;
}

const navigationItems = [
  { label: 'Overview', path: '/' },
  { label: 'Watchlist', path: '/components/watchlist' },
  { label: 'News', path: '/components/news' },
  { label: 'Planner', path: '/components/planner' },
  { label: 'Stock Analyzer', path: '/components/stock-gpt' }
];

const NavItem = ({ label, path, active }: { label: string; path: string; active: boolean }) => {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.push(path)}
      className="relative px-4 py-6 text-sm hover:text-black transition-colors"
    >
      <span className={active ? 'text-black' : 'text-gray-500'}>
        {label}
      </span>
      {active && (
        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black" />
      )}
    </button>
  );
};

const PageTemplate = ({ children, title, description }: PageTemplateProps) => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </header>
      <main className="flex-1 relative bg-background">
        {children}
      </main>
    </div>
  );
};

export default PageTemplate;