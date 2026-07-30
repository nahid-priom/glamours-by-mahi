import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '@/lib/supabase'

export default function Index() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(Boolean(data.session))
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(Boolean(s))
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    )
  }
  return <Redirect href={session ? '/(app)' : '/(auth)/login'} />
}
