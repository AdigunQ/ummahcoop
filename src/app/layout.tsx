import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FAAN Staff Ummah Cooperative',
  description: 'FAAN Staff Ummah Multipurpose Cooperative management portal',
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9fc' },
    { media: '(prefers-color-scheme: dark)', color: '#080c16' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ummah Cooperative" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: 'toast-custom',
              style: {
                background: 'rgb(17 23 38)',
                color: '#f1f5f9',
                border: '1px solid rgb(36 47 70)',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 500,
                padding: '12px 14px',
              },
              success: {
                duration: 3000,
                iconTheme: { primary: '#10b981', secondary: '#0b1220' },
              },
              error: {
                duration: 5000,
                iconTheme: { primary: '#ef4444', secondary: '#0b1220' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
