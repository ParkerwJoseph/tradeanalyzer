'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PageTemplate from '@/components/layout/PageTemplate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { updateProfile } from 'firebase/auth'
import { User, Shield, CreditCard } from 'lucide-react'
import { database } from '@/lib/firebase'
import { ref, update, onValue, get } from 'firebase/database'
import { storage } from '@/lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import TradingAnalyzer from '@/components/TradingAnalyzer'

interface UserProfile {
  subscriptionType: 'free' | 'premium' | 'enterprise';
  questionCount: number;
  createdAt: string;
  lastLogin: string;
  riskAnalysis?: {
    riskToleranceScore: number;
    riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
    holdingPeriodAnalysis?: string;
    instrumentAnalysis?: string;
    leveragedExposure?: string;
    dividendExposure?: string;
  };
  lastAnalysisDate?: string;
}

export default function AccountPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (userData) {
          setUserProfile({
            subscriptionType: userData.subscriptionType || 'free',
            questionCount: userData.questionCount || 0,
            createdAt: userData.createdAt || new Date().toISOString(),
            lastLogin: userData.lastLogin || new Date().toISOString(),
            riskAnalysis: userData.riskAnalysis || null,
            lastAnalysisDate: userData.lastAnalysisDate || null
          });
        }
      }
    };
    
    loadUserProfile();
    
    // Set up real-time listener for risk analysis updates
    if (user) {
      const userRef = ref(database, `users/${user.uid}`);
      const unsubscribe = onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.riskAnalysis) {
          setUserProfile(prev => prev ? {
            ...prev,
            riskAnalysis: data.riskAnalysis,
            lastAnalysisDate: data.lastAnalysisDate
          } : null);
        }
      });

      // Cleanup listener on unmount
      return () => unsubscribe();
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      // Update Firebase Auth profile
      await updateProfile(user, { 
        displayName: displayName 
      });

      // Update Realtime Database
      const userRef = ref(database, `users/${user.uid}`);
      await update(userRef, {
        displayName: displayName,
        lastUpdated: new Date().toISOString()
      });

      // Force refresh the auth token to update the display name
      await user.reload();
      window.location.reload(); // This will force a full refresh to update all components

      // Show success
      
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)
    try {
      // Upload image to Firebase Storage
      const imageRef = storageRef(storage, `profile-images/${user.uid}`)
      await uploadBytes(imageRef, file)
      const downloadURL = await getDownloadURL(imageRef)

      // Update auth profile
      await updateProfile(user, { photoURL: downloadURL })

      // Update database record
      const userRef = ref(database, `users/${user.uid}`)
      await update(userRef, {
        photoURL: downloadURL,
        updatedAt: new Date().toISOString()
      })

      // Force refresh
      window.location.reload()
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <PageTemplate title="Account" description="Manage your account settings">
      <div className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div 
                onClick={handleImageClick} 
                className="cursor-pointer relative group"
              >
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    className="h-20 w-20 rounded-full object-cover group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:opacity-80 transition-opacity">
                    <User className="h-10 w-10" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
              <div className="space-y-2 flex-1">
                <div>
                  <label className="text-sm font-medium">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <div className="px-3 py-2 border rounded-md bg-gray-50 mt-1">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={handleUpdateProfile}
              disabled={isSaving || !displayName}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-medium capitalize">
                  {userProfile?.subscriptionType || 'Free'} Plan
                </h3>
                <p className="text-sm text-muted-foreground">
                  Questions Asked: {userProfile?.questionCount || 0}
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Member Since</label>
              <div className="text-sm text-muted-foreground">
                {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Last Login</label>
              <div className="text-sm text-muted-foreground">
                {userProfile?.lastLogin ? new Date(userProfile.lastLogin).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Risk Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-4">
              {userProfile?.riskAnalysis ? (
                <>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {userProfile.riskAnalysis.riskToleranceScore.toFixed(1)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Risk Score - {userProfile.riskAnalysis.riskLevel} Trader
                    </p>
                    {userProfile.lastAnalysisDate && (
                      <p className="text-xs text-muted-foreground">
                        Last analyzed: {new Date(userProfile.lastAnalysisDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <TradingAnalyzer 
                    userId={user!.uid} 
                    onAnalysisComplete={(metrics) => {
                      setUserProfile(prev => prev ? {
                        ...prev,
                        riskAnalysis: metrics,
                        lastAnalysisDate: new Date().toISOString()
                      } : null)
                    }} 
                  />
                </>
              ) : (
                <div className="w-full">
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your trading history to get a personalized risk analysis
                  </p>
                  {user ? (
                    <TradingAnalyzer 
                      userId={user.uid}
                      onAnalysisComplete={(metrics) => {
                        setUserProfile(prev => prev ? {
                          ...prev,
                          riskAnalysis: metrics,
                          lastAnalysisDate: new Date().toISOString()
                        } : null)
                      }}
                    />
                  ) : (
                    <div>Loading...</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTemplate>
  );
} 