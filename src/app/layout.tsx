import './globals.css'
import '../styles/theme.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'PhantomPool - Zero-Knowledge Dark Pool',
  description: 'Privacy-first decentralized trading with zero-knowledge proofs',
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="mobile-container smooth-scroll">
      <body className="mobile-container antialiased">{children}</body>
    </html>
  )
}