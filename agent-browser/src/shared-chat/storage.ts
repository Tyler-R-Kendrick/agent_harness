import { get, set, del } from 'idb-keyval';
import { exportPublicKeyJwk, generateDeviceSigningKey } from './crypto';
import { secureRandomToken } from './random';

export type StoredDeviceIdentity = {
  deviceId: string;
  label: string;
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey | null;
  persistence: 'indexeddb' | 'memory';
  warning?: string;
};

const DEVICE_KEY = 'agent-browser.shared-chat.device-identity.v1';
let memoryIdentity: StoredDeviceIdentity | null = null;

function randomId(prefix: string): string {
  return secureRandomToken(prefix);
}

function isStoredDeviceIdentity(value: unknown): value is StoredDeviceIdentity {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as StoredDeviceIdentity).deviceId === 'string'
    && typeof (value as StoredDeviceIdentity).label === 'string'
    && ((value as StoredDeviceIdentity).persistence === 'indexeddb' || (value as StoredDeviceIdentity).persistence === 'memory')
    && Boolean((value as StoredDeviceIdentity).publicKeyJwk)
    && Boolean((value as StoredDeviceIdentity).privateKey);
}

export async function loadOrCreateDeviceIdentity(label = 'This browser'): Promise<StoredDeviceIdentity> {
  if (memoryIdentity) return memoryIdentity;
  try {
    const stored = await get(DEVICE_KEY);
    if (isStoredDeviceIdentity(stored)) {
      return { ...stored, persistence: 'indexeddb' };
    }
  } catch {
    // fall through to key generation
  }

  const keyPair = await generateDeviceSigningKey();
  const identity: StoredDeviceIdentity = {
    deviceId: randomId('dev'),
    label,
    publicKeyJwk: await exportPublicKeyJwk(keyPair.publicKey),
    privateKey: keyPair.privateKey,
    persistence: 'indexeddb',
  };
  try {
    await set(DEVICE_KEY, identity);
    return identity;
  } catch {
    memoryIdentity = {
      ...identity,
      persistence: 'memory',
      warning: 'This browser could not persist a non-extractable signing key in IndexedDB. Refreshing will require re-pairing.',
    };
    return memoryIdentity;
  }
}

export async function clearSharedChatDeviceIdentity(): Promise<void> {
  memoryIdentity = null;
  await del(DEVICE_KEY);
}
