import type { Correction } from '../../log/log.ts'
import { parseDemo } from '../../tutorial/demo.ts'
import type { AskReply } from './transport.ts'

// Firebase RTDB drops empty arrays and nulls, so a reply read back from
// mahjong/v1/results lacks `corrected: []` (and a null session id). Restore
// them before the UI maps over the list; without this the phone thread froze
// on the waiting bubble (pageerror "reading 'map'", 2026-11-21).

/** An ask reply as the relay stored it, made whole again. */
export function askReplyFromRtdb(v: unknown): AskReply {
  const o = v as Partial<AskReply> | null
  if (!o || typeof o !== 'object' || typeof o.answer !== 'string') throw new Error('worker reply has no answer')
  return {
    answer: o.answer,
    sessionId: typeof o.sessionId === 'string' ? o.sessionId : null,
    flagged: o.flagged === true,
    corrected: Array.isArray(o.corrected) ? (o.corrected as Correction[]) : [],
    demo: parseDemo(o.demo),
  }
}
