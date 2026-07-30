/**
 * @deprecated Exportable WebCrypto keys removed. Use security/device-key.
 * Re-exports installation helpers for gradual migration.
 */
export {
  deviceMeta,
  ensureHardwareDeviceKey as ensureDeviceKeyPair,
  getOrCreateInstallationId,
  signCanonicalPayload,
} from '../security/device-key'

/** @deprecated Thin challenge signing removed — use signCanonicalPayload */
export async function signChallengePayload(
  _challengeId: string,
  _nonce: string,
  _eventType: string,
): Promise<string> {
  throw new Error('signChallengePayload removed — use hardware canonical signing')
}
