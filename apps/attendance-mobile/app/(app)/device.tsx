import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { getContext, registerDevice } from '@/api/attendance'
import { biometricCapability } from '@/lib/biometric'
import { collectBestLocation } from '@/lib/location'
import { deviceMeta, ensureHardwareDeviceKey } from '@/security/device-key'

export default function DeviceScreen() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['mobile-attendance-context'],
    queryFn: getContext,
  })

  const register = useMutation({
    mutationFn: async () => {
      const bio = await biometricCapability()
      if (!bio.biometric_supported) throw new Error('এই ডিভাইসে বায়োমেট্রিক সাপোর্ট নেই।')
      // Hardware key creation itself is biometric-gated on next signature;
      // createKeys stores non-exportable key in Android Keystore / iOS Keychain.
      const keys = await ensureHardwareDeviceKey()
      const meta = await deviceMeta()
      let location: Awaited<ReturnType<typeof collectBestLocation>> | null = null
      try {
        location = await collectBestLocation()
      } catch {
        /* registration location preferred but not hard-required if GPS fails briefly */
      }
      return registerDevice({
        installation_id: keys.installationId,
        public_key: keys.publicKeyB64,
        hardware_backed: true,
        ...meta,
        ...bio,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy,
      })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mobile-attendance-context'] }),
  })

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E11D48" />
      </View>
    )
  }

  const status = data?.device?.status ?? 'none'

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registered device</Text>
      <Text style={styles.status}>Status: {status}</Text>
      <Text style={styles.meta}>{data?.device?.device_name ?? 'No device yet'}</Text>
      <Text style={styles.meta}>Keys: hardware-backed (biometric unlock)</Text>
      {status === 'pending' ? (
        <Text style={styles.hint}>অ্যাডমিন অনুমোদনের অপেক্ষায় আছে।</Text>
      ) : null}
      {status === 'rejected' || status === 'revoked' || status === 'none' ? (
        <Pressable
          style={styles.btn}
          onPress={() => register.mutate()}
          disabled={register.isPending}
        >
          {register.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Register this device</Text>
          )}
        </Pressable>
      ) : null}
      {register.error ? (
        <Text style={styles.error}>{(register.error as Error).message}</Text>
      ) : null}
      {register.data ? (
        <Text style={styles.ok}>
          Request submitted ({String((register.data as { status?: string }).status)})
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  status: { marginTop: 12, fontSize: 16, textTransform: 'capitalize' },
  meta: { color: '#6B7280', marginTop: 6 },
  hint: { marginTop: 16, color: '#B45309' },
  btn: {
    marginTop: 24,
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#E11D48', marginTop: 12 },
  ok: { color: '#059669', marginTop: 12 },
})
