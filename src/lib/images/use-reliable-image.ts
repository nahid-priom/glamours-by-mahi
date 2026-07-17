import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isValidImageSource, normalizeImageUrl, PRODUCT_PLACEHOLDER } from './image-utils'

export type ReliableImageStatus = 'loading' | 'loaded' | 'error'

/**
 * Shared image-loading lifecycle used by AppImage, LazyImage and CategoryImage.
 *
 * Fixes the SPA-navigation blank-image bug: cached images can fire `load`
 * before React attaches the onLoad handler, leaving state stuck at "loading"
 * (skeleton on top, img at opacity-0). After every mount / src change we check
 * `img.complete` and resolve the state manually, using `decode()` when
 * available so the reveal never flashes.
 *
 * Fallbacks are tried once each in order (src → fallbacks…); when the whole
 * chain fails the status becomes "error" so callers can render a styled
 * placeholder instead of a broken-image icon.
 */
export function useReliableImage(
  src: string | null | undefined,
  fallbacks: Array<string | null | undefined> = [PRODUCT_PLACEHOLDER],
) {
  const chain = useMemo(() => {
    const urls: string[] = []
    for (const candidate of [src, ...fallbacks]) {
      if (!isValidImageSource(candidate)) continue
      const url = normalizeImageUrl(candidate)
      if (!urls.includes(url)) urls.push(url)
    }
    if (urls.length === 0) urls.push(PRODUCT_PLACEHOLDER)
    return urls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbacks.join('|')])

  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<ReliableImageStatus>('loading')
  const imgRef = useRef<HTMLImageElement | null>(null)

  const chainKey = chain.join('|')
  useEffect(() => {
    setIndex(0)
    setStatus('loading')
  }, [chainKey])

  const currentSrc = chain[Math.min(index, chain.length - 1)]

  const handleLoad = useCallback(() => setStatus('loaded'), [])

  const handleError = useCallback(() => {
    setIndex((prev) => {
      if (prev + 1 < chain.length) {
        setStatus('loading')
        return prev + 1
      }
      setStatus('error')
      return prev
    })
  }, [chain.length])

  // Cached-image detection: if the browser already finished this src before
  // React attached listeners, resolve the state here instead of waiting for
  // an onLoad that will never fire.
  useEffect(() => {
    const img = imgRef.current
    if (!img || !img.complete) return

    if (img.naturalWidth > 0) {
      let cancelled = false
      const markLoaded = () => {
        if (!cancelled) setStatus('loaded')
      }
      if (typeof img.decode === 'function') {
        img.decode().then(markLoaded, markLoaded)
      } else {
        markLoaded()
      }
      return () => {
        cancelled = true
      }
    }

    // complete but zero-sized → the src is broken; advance the chain.
    handleError()
  }, [currentSrc, handleError])

  return { imgRef, currentSrc, status, handleLoad, handleError }
}
