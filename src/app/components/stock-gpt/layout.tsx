'use client'

import { Suspense } from 'react'
import PageTemplate from '@/components/layout/PageTemplate'

export default function StockGPTLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={
            <PageTemplate title="" description="">
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
            </PageTemplate>
        }>
            {children}
        </Suspense>
    )
} 