import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 767px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
