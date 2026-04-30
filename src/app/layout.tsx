import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Project Calendar | Mustit',
  description: '머스트잇 프로젝트 캘린더',
  manifest: '/manifest.webmanifest',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isLoginPage = pathname === '/login' || pathname.startsWith('/auth/')

  return (
    <html lang="ko">
      <body suppressHydrationWarning style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div className="flex min-h-screen bg-gray-50">
          {!isLoginPage && <Sidebar />}
          <main className={isLoginPage ? 'flex-1' : 'flex-1 min-w-0'}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
