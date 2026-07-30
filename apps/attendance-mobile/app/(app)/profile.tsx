import { useQuery } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { getContext } from '@/api/attendance'
import { supabase } from '@/lib/supabase'

export default function ProfileScreen() {
  const { data } = useQuery({
    queryKey: ['mobile-attendance-context'],
    queryFn: getContext,
  })

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{data?.employee.full_name ?? '—'}</Text>
      <Text style={styles.meta}>Employee ID: {data?.employee.employee_code}</Text>
      <Text style={styles.meta}>Branch: {data?.employee.branch_id ?? '—'}</Text>
      <Text style={styles.meta}>Shift: {data?.shift?.name ?? '—'}</Text>
      <Text style={styles.meta}>Device: {data?.device?.status ?? 'none'}</Text>
      <Pressable style={styles.btn} onPress={logout}>
        <Text style={styles.btnText}>Logout</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  name: { fontSize: 22, fontWeight: '700' },
  meta: { marginTop: 8, color: '#6B7280', fontSize: 15 },
  btn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#E11D48',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#E11D48', fontWeight: '700' },
})
