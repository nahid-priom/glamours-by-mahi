import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { listOwnHistory } from '@/api/attendance'

export default function HistoryScreen() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['mobile-attendance-history'],
    queryFn: () => listOwnHistory(40),
  })

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E11D48" />
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{(error as Error).message}</Text>
      </View>
    )
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={data}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No attendance yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.date}>{item.work_date}</Text>
          <Text style={styles.status}>{item.status}</Text>
          <Text style={styles.meta}>
            In {item.first_in ? new Date(item.first_in).toLocaleTimeString() : '—'} · Out{' '}
            {item.last_out ? new Date(item.last_out).toLocaleTimeString() : '—'}
          </Text>
          <Text style={styles.meta}>
            Late {item.late_minutes}m · Work {item.working_minutes}m · OT {item.overtime_minutes}m
          </Text>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  date: { fontWeight: '700', fontSize: 16 },
  status: { color: '#E11D48', marginTop: 2, textTransform: 'capitalize' },
  meta: { color: '#6B7280', marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  error: { color: '#E11D48' },
})
