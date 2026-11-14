import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type BreadcrumbLabelsContextValue = {
  labels: Record<string, string>
  setLabel: (id: string, label: string | null | undefined) => void
}

const BreadcrumbLabelsContext = createContext<BreadcrumbLabelsContextValue | null>(null)

export function BreadcrumbLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({})

  const setLabel = useCallback((id: string, label: string | null | undefined) => {
    if (!id) return
    const next = label?.trim() || ''
    setLabels((prev) => {
      if (!next) {
        if (!(id in prev)) return prev
        const { [id]: _, ...rest } = prev
        return rest
      }
      if (prev[id] === next) return prev
      return { ...prev, [id]: next }
    })
  }, [])

  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel])

  return (
    <BreadcrumbLabelsContext.Provider value={value}>{children}</BreadcrumbLabelsContext.Provider>
  )
}

export function useBreadcrumbLabels() {
  return useContext(BreadcrumbLabelsContext)
}

/** Publish a human-readable breadcrumb label for the current entity id. Clears on unmount. */
export function useBreadcrumbLabel(id: string | null | undefined, label: string | null | undefined) {
  const ctx = useBreadcrumbLabels()
  const setLabel = ctx?.setLabel

  useEffect(() => {
    if (!id || !setLabel) return
    setLabel(id, label)
    return () => setLabel(id, null)
  }, [id, label, setLabel])
}
