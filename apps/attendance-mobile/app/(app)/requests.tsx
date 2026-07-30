import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { requestCorrection } from '@/api/attendance'

export default function RequestsScreen() {
  const [reason, setReason] = useState('')
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10))

  const mutation = useMutation({
    mutationFn: () =>
      requestCorrection({
        request_type: 'correction',
        reason: reason.trim() || 'Missed attendance',
        work_date: workDate,
      }),
  })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance correction</Text>
      <Text style={styles.hint}>মিসড চেক-ইন/আউট বা সংশোধনের জন্য অনুরোধ পাঠান।</Text>
      <TextInput
        style={styles.input}
        value={workDate}
        onChangeText={setWorkDate}
        placeholder="YYYY-MM-DD"
      />
      <TextInput
        style={[styles.input, styles.area]}
        value={reason}
        onChangeText={setReason}
        placeholder="Reason"
        multiline
      />
      <Pressable
        style={styles.btn}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Submit request</Text>
        )}
      </Pressable>
      {mutation.isSuccess ? (
        <Text style={styles.ok}>Request submitted for review.</Text>
      ) : null}
      {mutation.error ? (
        <Text style={styles.error}>{(mutation.error as Error).message}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { color: '#6B7280', marginVertical: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  area: { minHeight: 100, textAlignVertical: 'top' },
  btn: {
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ok: { color: '#059669', marginTop: 12 },
  error: { color: '#E11D48', marginTop: 12 },
})
