import { relayConfigured, relayTransport } from './relay.ts'
import { bridgeTransport, type Transport } from './transport.ts'

const LOOPBACK = new Set(['127.0.0.1', 'localhost'])

/** The PC's loopback page uses the bridge; any other host goes through the relay. */
export const usesRelay = (): boolean => !LOOPBACK.has(location.hostname) && relayConfigured()

export function pickTransport(): Transport {
  return usesRelay() ? relayTransport : bridgeTransport
}
