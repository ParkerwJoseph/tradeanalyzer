import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { database } from '@/lib/firebase'
import { ref, update } from 'firebase/database'

interface UserInfoFormProps {
  uid: string;
  email: string;
  onComplete: () => void;
  initialData?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
  };
}

export default function UserInfoForm({ uid, email, onComplete, initialData }: UserInfoFormProps) {
  const [firstName, setFirstName] = useState(initialData?.firstName || '')
  const [lastName, setLastName] = useState(initialData?.lastName || '')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const userRef = ref(database, `users/${uid}`)
      await update(userRef, {
        firstName,
        lastName,
        phone,
        displayName: `${firstName} ${lastName}`,
        email,
        updatedAt: new Date().toISOString()
      })
      onComplete()
    } catch (error) {
      console.error('Error updating user info:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <Input
          type="tel"
          placeholder="Phone Number (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Complete Profile'}
      </Button>
    </form>
  )
} 