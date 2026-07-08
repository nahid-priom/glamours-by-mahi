import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function scrollContainersToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  document.body.scrollTo({ top: 0, left: 0, behavior: 'smooth' })

  document.querySelectorAll('main').forEach((element) => {
    element.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  })
}

export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    scrollContainersToTop()
  }, [pathname, search, hash])

  return null
}
