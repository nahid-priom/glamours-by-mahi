import * as LocalAuthentication from 'expo-local-authentication'

export async function requireBiometric(reason = 'Confirm attendance'): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const enrolled = await LocalAuthentication.isEnrolledAsync()
  if (!hasHardware || !enrolled) {
    throw new Error('এই ডিভাইসে বায়োমেট্রিক সাপোর্ট নেই।')
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: true,
  })
  return result.success
}

export async function biometricCapability() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const enrolled = await LocalAuthentication.isEnrolledAsync()
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
  const face = LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
  const finger = LocalAuthentication.AuthenticationType.FINGERPRINT
  return {
    biometric_supported: hasHardware && enrolled,
    biometric_type: types.includes(face) ? 'face' : types.includes(finger) ? 'fingerprint' : 'none',
  }
}
