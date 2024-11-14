'use client'

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  BellIcon,
  Settings,
  User
} from 'lucide-react';

interface PageTemplateProps {
  children?: React.ReactNode;
  title: string;
  description?: string;
}

const navigationItems = [
  { label: 'Overview', path: '/' },
  { label: 'Watchlist', path: '/components/watchlist' },
  { label: 'News', path: '/components/news' },
  { label: 'Planner', path: '/components/planner' }
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
    <div className="flex flex-col h-screen">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-20">
          <div className="flex items-center justify-between h-full">
            {/* Left side - Logo */}
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold">Trading App</h1>
            </div>

            {/* Center - Navigation */}
            <nav className="flex items-center absolute left-1/2 transform -translate-x-1/2">
              {navigationItems.map((item) => (
                <NavItem 
                  key={item.path}
                  label={item.label}
                  path={item.path}
                  active={pathname === item.path}
                />
              ))}
            </nav>

            {/* Right side - Icons */}
            <div className="flex items-center gap-6">
              <button className="p-2 text-gray-500 hover:text-black transition-colors">
                <BellIcon size={20} />
              </button>
              <button className="p-2 text-gray-500 hover:text-black transition-colors">
                <Settings size={20} />
              </button>
             
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-gray-500">{description}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageTemplate;