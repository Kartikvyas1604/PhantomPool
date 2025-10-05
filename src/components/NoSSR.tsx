'use client'

import dynamic from 'next/dynamic'

// Create a wrapper that disables SSR for components that must be client-only
export const NoSSR = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false
})

export default NoSSR