import { bridgeTransport, type Transport } from './transport.ts'

/** Loopback page talks to the bridge directly; the public site will use the relay. */
export function pickTransport(): Transport {
  return bridgeTransport
}
