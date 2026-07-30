import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import * as Crypto from 'expo-crypto'
import * as Application from 'expo-application'
import { Platform } from 'react-native'
import {
  createChallenge,
  getContext,
  submitAttendance,
} from '@/api/attendance'
import { collectBestLocation } from '@/lib/location'
import { canonicalizeAttendancePayload } from '@/security/device-key/canonical'
import {
  getStoredPublicKey,
  hardwareKeysExist,
  signCanonicalPayload,
} from '@/security/device-key'
import { supabase } from '@/lib/supabase'

export default function HomeScreen() {
  const qc = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [distanceHint, setDistanceHint] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-attendance-context'],
    queryFn: getContext,
    refetchInterval: 30_000,
  })

  const punch = useMutation({
    mutationFn: async (eventType: 'check_in' | 'check_out') => {
      const net = await NetInfo.fetch()
      if (!net.isConnected) throw new Error('ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।')
      if (!data?.device || data.device.status !== 'approved') {
        throw new Error('এই ডিভাইসটি এখনো অনুমোদিত নয়।')
      }
      const hwOk = await hardwareKeysExist()
      const pub = await getStoredPublicKey()
      if (!hwOk || !pub) {
        throw new Error('ডিভাইস কী অনুপস্থিত — Device ট্যাব থেকে আবার রেজিস্টার করুন।')
      }

      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Session expired — please login again')

      const challenge = await createChallenge(data.device.id, eventType)
      const location = await collectBestLocation()
      if (data.location && typeof data.location.allowed_radius_metres === 'number') {
        setDistanceHint(
          `Location accuracy ±${Math.round(location.accuracy)}m (server verifies fence)`,
        )
      }

      const idempotencyKey = Crypto.randomUUID()
      const integrityNonce =
        challenge.integrity_nonce ?? Crypto.randomUUID().replace(/-/g, '')

      const canonical = {
        version: 1 as const,
        accuracy: location.accuracy,
        app_version: Application.nativeApplicationVersion ?? '1.0.0',
        attendance_date: String(challenge.attendance_date ?? data.work_date),
        attendance_location_id: challenge.attendance_location_id ?? data.location?.id ?? null,
        auth_user_id: auth.user.id,
        branch_id: challenge.branch_id ?? data.employee.branch_id,
        challenge_id: challenge.challenge_id,
        challenge_nonce: challenge.nonce,
        device_id: data.device.id,
        employee_id: String(challenge.employee_id ?? data.employee.id),
        event_type: eventType,
        idempotency_key: idempotencyKey,
        integrity_nonce: integrityNonce,
        latitude: location.latitude,
        location_captured_at: location.captured_at,
        longitude: location.longitude,
        organization_id: String(challenge.organization_id ?? ''),
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        qr_token_hash: null as string | null,
        shift_id: challenge.shift_id ?? data.shift?.id ?? null,
      }

      const canonicalJson = canonicalizeAttendancePayload(canonical)
      const { signatureB64 } = await signCanonicalPayload(
        canonicalJson,
        eventType === 'check_in' ? 'Check-in confirm' : 'Check-out confirm',
      )

      return submitAttendance({
        event_type: eventType,
        device_id: data.device.id,
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        signature: signatureB64,
        employee_id: canonical.employee_id,
        organization_id: canonical.organization_id,
        branch_id: canonical.branch_id,
        shift_id: canonical.shift_id,
        attendance_location_id: canonical.attendance_location_id,
        attendance_date: canonical.attendance_date,
        idempotency_key: idempotencyKey,
        integrity_nonce: integrityNonce,
        app_version: canonical.app_version,
        platform: canonical.platform,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        heading: location.heading,
        speed: location.speed,
        client_captured_at: location.captured_at,
        is_mocked: location.is_mocked,
        is_emulator: false,
        app_integrity_token: '', // filled by Play Integrity on enforce builds
      })
    },
    onSuccess: (res) => {
      setMessage(
        res.ok
          ? res.decision === 'pending_review'
            ? String(res.reason ?? 'Review-এ পাঠানো হয়েছে।')
            : 'Attendance সফল হয়েছে।'
          : String(res.reason ?? 'Failed'),
      )
      void qc.invalidateQueries({ queryKey: ['mobile-attendance-context'] })
      void refetch()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E11D48" size="large" />
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

  const checkedIn = Boolean(data?.today?.first_in)
  const checkedOut = Boolean(data?.today?.last_out)
  const deviceOk = data?.device?.status === 'approved'

  let primaryLabel = 'Check In'
  let primaryAction: 'check_in' | 'check_out' | null = 'check_in'
  let statusBanner = 'Ready'

  if (!deviceOk) {
    primaryLabel = 'Device Approval Pending'
    primaryAction = null
    statusBanner = 'ডিভাইস অনুমোদনের অপেক্ষায়'
  } else if (checkedOut) {
    primaryLabel = 'Attendance Completed'
    primaryAction = null
    statusBanner = 'আজকের উপস্থিতি সম্পন্ন'
  } else if (checkedIn) {
    primaryLabel = 'Check Out'
    primaryAction = 'check_out'
    statusBanner = 'Checked in — check-out করতে পারেন'
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{data?.employee.full_name}</Text>
      <Text style={styles.meta}>ID: {data?.employee.employee_code}</Text>
      <Text style={styles.meta}>
        Shift: {data?.shift?.name ?? '—'} ({data?.shift?.start_time ?? ''} – {data?.shift?.end_time ?? ''})
      </Text>
      <Text style={styles.meta}>Date: {data?.work_date}</Text>
      <View style={styles.card}>
        <Text style={styles.banner}>{statusBanner}</Text>
        <Text style={styles.row}>
          In: {data?.today?.first_in ? new Date(data.today.first_in).toLocaleTimeString() : '—'}
        </Text>
        <Text style={styles.row}>
          Out: {data?.today?.last_out ? new Date(data.today.last_out).toLocaleTimeString() : '—'}
        </Text>
        <Text style={styles.row}>Device: {data?.device?.status ?? 'not registered'}</Text>
        <Text style={styles.row}>Location policy: {data?.location?.name ?? 'not set'}</Text>
        {distanceHint ? <Text style={styles.row}>{distanceHint}</Text> : null}
      </View>

      <Pressable
        style={[styles.cta, !primaryAction && styles.ctaDisabled]}
        disabled={!primaryAction || punch.isPending}
        onPress={() => primaryAction && punch.mutate(primaryAction)}
      >
        {punch.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>{primaryLabel}</Text>
        )}
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#F9FAFB', flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '700', color: '#111827' },
  meta: { color: '#6B7280', marginTop: 4, fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  banner: { fontSize: 16, fontWeight: '700', color: '#E11D48', marginBottom: 10 },
  row: { fontSize: 15, color: '#374151', marginBottom: 6 },
  cta: {
    marginTop: 28,
    backgroundColor: '#E11D48',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: '#9CA3AF' },
  ctaText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  message: { marginTop: 16, textAlign: 'center', color: '#111827', fontSize: 15 },
  error: { color: '#E11D48', padding: 16 },
})
