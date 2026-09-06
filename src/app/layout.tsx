import type { Metadata, Viewport } from 'next'
import { Source_Sans_3 } from 'next/font/google'
import './globals.css'
import './admin-workspace.css'
import './auth-pages.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'react-hot-toast'

const sans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ummah Coop',
  description: 'Private cooperative savings and loan portal for Ummah Coop members',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#111c18' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={sans.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ummah Coop" />
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
                background: 'rgb(var(--surface))',
                color: 'rgb(var(--fg))',
                border: '1px solid rgb(var(--border))',
                borderRadius: '12px',
                fontSize: '1.0625rem',
                lineHeight: 1.5,
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
