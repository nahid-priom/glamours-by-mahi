import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'

export function useOnlineStatus() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const wasOfflineRef = useRef(false)
  const notifiedOfflineRef = useRef(false)

  useEffect(() => {
    const goOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
      if (!notifiedOfflineRef.current) {
        notifiedOfflineRef.current = true
      }
    }

    const goOnline = () => {
      setIsOnline(true)
      notifiedOfflineRef.current = false
      if (wasOfflineRef.current) {
        toast("You're back online.")
        queryClient.invalidateQueries()
        wasOfflineRef.current = false
      }
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [queryClient, toast])

  return {
    isOnline,
    wasOffline: wasOfflineRef.current,
  }
}
