import type { Topic } from './log.ts'

// Topic tags for the tutorial brief: from what was picked, then from words in
// the question (English and Polish keywords).

const ENTITY_TOPIC: [RegExp, Topic][] = [
  [/^(hand|discard|meld|dora)\b/, 'tile'],
  [/^(score|hanfu|result|end)\b/, 'scoring'],
  [/^(round|wall|button|riichi)\b/, 'flow'],
]

const WORD_TOPIC: [RegExp, Topic][] = [
  [/yaku|yakuman|riichi|pinfu|tanyao|chiitoi|honitsu|yakuhai/i, 'yaku'],
  [/\b(fu|han|points?|score|mangan|punkt\w*|wynik)\b/i, 'scoring'],
  [/turn|whose|why can.?t|call|claim|draw|kolej|tura|runda|round/i, 'flow'],
  [/\btile|kafel\w*|płyt\w*/i, 'tile'],
]

export function topicsFor(entities: string[], question: string): Topic[] {
  const out = new Set<Topic>()
  for (const e of entities) for (const [re, t] of ENTITY_TOPIC) if (re.test(e)) out.add(t)
  for (const [re, t] of WORD_TOPIC) if (re.test(question)) out.add(t)
  if (out.size === 0) out.add('flow')
  const order: Topic[] = ['tile', 'yaku', 'scoring', 'flow']
  return order.filter((t) => out.has(t))
}
