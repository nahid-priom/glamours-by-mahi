import * as Location from 'expo-location'

export type LocationSample = {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  heading: number | null
  speed: number | null
  captured_at: string
  is_mocked: boolean
}

const MAX_ACCURACY = 25
const MAX_AGE_MS = 15_000
const SAMPLE_COUNT = 3

export async function collectBestLocation(): Promise<LocationSample> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('লোকেশন অনুমতি প্রয়োজন।')
  }

  const samples: LocationSample[] = []
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    })
    const captured = new Date(pos.timestamp)
    samples.push({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? 999,
      altitude: pos.coords.altitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      captured_at: captured.toISOString(),
      is_mocked: Boolean((pos as { mocked?: boolean }).mocked),
    })
    if (i < SAMPLE_COUNT - 1) {
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  const now = Date.now()
  const valid = samples.filter(
    (s) =>
      s.accuracy <= MAX_ACCURACY &&
      now - new Date(s.captured_at).getTime() <= MAX_AGE_MS,
  )
  if (valid.length === 0) {
    throw new Error('আপনার লোকেশনের নির্ভুলতা যথেষ্ট নয়।')
  }
  valid.sort((a, b) => a.accuracy - b.accuracy)
  return valid[0]
}
