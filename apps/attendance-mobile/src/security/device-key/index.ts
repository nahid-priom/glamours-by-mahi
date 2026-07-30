/**
 * Hardware-backed device key (Android Keystore / iOS Keychain via react-native-biometrics).
 * Biometric proof = successful createSignature (key unlock), not a client boolean.
 *
 * Requires a Dev Client / bare build — Expo Go cannot access hardware keys.
 */

import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import * as Application from 'expo-application'
import { Platform } from 'react-native'
import ReactNativeBiometrics from 'react-native-biometrics'

const KEY_BACKEND = 'attendance_device_key_backend_v2'
const PUBLIC_KEY_B64 = 'attendance_device_public_key_hw_b64'
const INSTALLATION_ID = 'attendance_installation_id'
/** Legacy exportable WebCrypto keys — force re-registration if present */
const LEGACY_PRIVATE = 'attendance_device_private_key_spki_b64'
const LEGACY_PUBLIC = 'attendance_device_public_key_spki_b64'

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: false })

export type DeviceKeyPair = {
  publicKeyB64: string
  installationId: string
  hardwareBacked: true
}

async function wipeLegacyExportableKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_PRIVATE)
  await SecureStore.deleteItemAsync(LEGACY_PUBLIC)
}

export async function getOrCreateInstallationId(): Promise<string> {
  let id = await SecureStore.getItemAsync(INSTALLATION_ID)
  if (id) return id
  id = Crypto.randomUUID()
  await SecureStore.setItemAsync(INSTALLATION_ID, id)
  return id
}

export async function ensureHardwareDeviceKey(): Promise<DeviceKeyPair> {
  await wipeLegacyExportableKeys()
  const installationId = await getOrCreateInstallationId()

  const backend = await SecureStore.getItemAsync(KEY_BACKEND)
  const existingPub = await SecureStore.getItemAsync(PUBLIC_KEY_B64)
  if (backend === 'hardware_v2' && existingPub) {
    const { keysExist } = await rnBiometrics.biometricKeysExist()
    if (keysExist) {
      return { publicKeyB64: existingPub, installationId, hardwareBacked: true }
    }
  }

  const { available, biometryType } = await rnBiometrics.isSensorAvailable()
  if (!available || !biometryType) {
    throw new Error('এই ডিভাইসে বায়োমেট্রিক সাপোর্ট নেই।')
  }

  // Replace any prior keys
  try {
    const { keysExist } = await rnBiometrics.biometricKeysExist()
    if (keysExist) await rnBiometrics.deleteKeys()
  } catch {
    /* ignore */
  }

  const { publicKey } = await rnBiometrics.createKeys()
  if (!publicKey) throw new Error('Hardware key generation failed')

  await SecureStore.setItemAsync(PUBLIC_KEY_B64, publicKey)
  await SecureStore.setItemAsync(KEY_BACKEND, 'hardware_v2')

  return { publicKeyB64: publicKey, installationId, hardwareBacked: true }
}

/** Sign canonical UTF-8 payload; biometric prompt unlocks non-exportable key. */
export async function signCanonicalPayload(
  canonicalJson: string,
  promptMessage = 'Confirm attendance',
): Promise<{ signatureB64: string; biometricGateUsed: true }> {
  const backend = await SecureStore.getItemAsync(KEY_BACKEND)
  if (backend !== 'hardware_v2') {
    throw new Error('Device key missing — re-register device (hardware key required)')
  }

  const { success, signature, error } = await rnBiometrics.createSignature({
    promptMessage,
    payload: canonicalJson,
  })

  if (!success || !signature) {
    throw new Error(error || 'Fingerprint verification সম্পন্ন হয়নি।')
  }

  return { signatureB64: signature, biometricGateUsed: true }
}

export async function hardwareKeysExist(): Promise<boolean> {
  const backend = await SecureStore.getItemAsync(KEY_BACKEND)
  if (backend !== 'hardware_v2') return false
  const { keysExist } = await rnBiometrics.biometricKeysExist()
  return keysExist
}

export async function getStoredPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(PUBLIC_KEY_B64)
}

export async function deviceMeta() {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    device_name: Application.applicationName ?? 'Attendance',
    app_version: Application.nativeApplicationVersion ?? '1.0.0',
    operating_system: Platform.OS,
    os_version: String(Platform.Version),
    key_backend: 'hardware_v2',
  }
}
