'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { ThemeToggle } from '@/components/theme-toggle'
import { LineChart, User, LogOut } from 'lucide-react'

export function Navbar() {
  const router = useRouter()
  const [user, loading] = useAuthState(auth)

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-lg border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center space-x-2 text-xl font-bold"
          >
            <span>StocX</span>
          </Link>

          <div className="flex items-center space-x-4">
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4">
                    <Link href="/">
                      <Button variant="ghost" className="text-sm">
                        Analysis
                      </Button>
                    </Link>
                    <Link href="/components/discover">
                      <Button variant="ghost" className="text-sm">
                        Discover
                      </Button>
                    </Link>
                    <Link href="/components/account">
                      <Button variant="ghost" size="icon">
                        <User className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Link href="/auth/signin">
                      <Button variant="ghost" className="text-sm">
                        Login
                      </Button>
                    </Link>
                    <Link href="/auth/signin">
                      <Button variant="default" className="text-sm">
                        Create Account
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  )
} 