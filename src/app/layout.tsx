import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'FAAN STAFF UMMAH MULTIPURPOSE COOPERATIVE',
  description: 'FAAN STAFF UMMAH MULTIPURPOSE COOPERATIVE management system',
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/icon-192x192.png',
  },
  themeColor: '#1a5f2a',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a5f2a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FAAN STAFF UMMAH MULTIPURPOSE COOPERATIVE" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1a5f2a" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#2e7d32',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#c62828',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
