'use client'

import { useState } from 'react'
import { auth, database } from '@/lib/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'
import { initializeUserData } from '@/lib/userStore'
import { ref, update } from 'firebase/database'
import Link from 'next/link'

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Update user data with form info
      const userRef = ref(database, `users/${user.uid}`)
      await update(userRef, {
        firstName,
        lastName,
        username,
        email,
        displayName: `${firstName} ${lastName}`,
        updatedAt: new Date().toISOString()
      })

      const success = await initializeUserData(user.uid)
      if (success) {
        router.push('/')
      }
    } catch (error: any) {
      setError(error.message)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Section */}
      <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
        <h1 className="text-3xl font-bold mb-2">Start your 30-day free trial</h1>
        <p className="text-muted-foreground mb-8">No credit card required</p>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium mb-4">Register with:</p>
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="w-full">
                Google
              </Button>
              <Button variant="outline" className="w-full">
                Github
              </Button>
              <Button variant="outline" className="w-full">
                Gitlab
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Minimum length is 8 characters
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-primary">
              Sign Up
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>

      {/* Right Section */}
      <div className="hidden md:flex md:w-1/2 bg-muted items-center justify-center p-12">
        <div className="space-y-6 max-w-sm">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Invite unlimited colleagues</h3>
            <p className="text-muted-foreground">
              Integrate with guaranteed developer-friendly APIs or openly to choose a build-ready or low-code solution.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Built-in security</h3>
            <p className="text-muted-foreground">
              Keep your team members and customers in the loop by sharing your dashboard public.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 