import { useEffect, type RefObject } from 'react'

/**
 * Calls `handler` when a pointer press lands outside the referenced element.
 * Listeners are attached only while `enabled` is true and cleaned up on
 * disable/unmount, so no duplicate or leaked listeners accumulate.
 *
 * Uses `pointerdown` for reliable mouse + touch dismissal that fires before
 * focus/click, and skips the work entirely when the layer is closed.
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: PointerEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: PointerEvent) => {
      const el = ref.current
      if (!el || el.contains(event.target as Node)) return
      handler(event)
    }

    document.addEventListener('pointerdown', listener)
    return () => document.removeEventListener('pointerdown', listener)
  }, [ref, handler, enabled])
}
