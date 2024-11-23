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
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`py-4 px-3 text-sm font-medium ${
                  pathname === item.path
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </header>
      <main className="flex-1 relative bg-white">
        {children}
      </main>
    </div>
  );
};

export default PageTemplate;