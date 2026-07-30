/**
 * Minimal ambient types for react-native-biometrics (Dev Client).
 */
declare module 'react-native-biometrics' {
  export type BiometryType = 'TouchID' | 'FaceID' | 'Biometrics'

  export default class ReactNativeBiometrics {
    constructor(options?: { allowDeviceCredentials?: boolean })
    isSensorAvailable(): Promise<{
      available: boolean
      biometryType?: BiometryType
      error?: string
    }>
    createKeys(): Promise<{ publicKey: string }>
    biometricKeysExist(): Promise<{ keysExist: boolean }>
    deleteKeys(): Promise<{ keysDeleted: boolean }>
    createSignature(options: {
      promptMessage: string
      payload: string
      cancelButtonText?: string
    }): Promise<{ success: boolean; signature?: string; error?: string }>
  }
}
