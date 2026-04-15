import ClientPage from './client-page'

// Force dynamic rendering — skip static prerendering during build.
// This avoids all browser API (navigator, window, document) SSR errors
// that occur when client components are evaluated server-side.
export const dynamic = 'force-dynamic'

export default function Home() {
  return <ClientPage />
}
