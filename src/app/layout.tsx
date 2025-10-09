import './globals.css'
import '../styles/theme.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PhantomPool - Zero-Knowledge Dark Pool',
  description: 'Privacy-first decentralized trading with zero-knowledge proofs',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}