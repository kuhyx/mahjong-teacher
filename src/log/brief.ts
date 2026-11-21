import { isClearPhrase, isTriggerPhrase } from './clear.ts'
import type { ConfusionItem, PlayLog, Topic } from './log.ts'

// Brief for the follow-up tutorial task: every marked item, grouped by topic,
// with the player's questions and the final answer. Repo-only text (DOCS file).

const ORDER: Topic[] = ['tile', 'yaku', 'scoring', 'flow']

function itemBlock(it: ConfusionItem): string {
  const questions = it.transcript.filter((t) => t.role === 'user' && !isClearPhrase(t.text) && !isTriggerPhrase(t.text)).map((t) => `  - Q: ${t.text}`)
  const last = [...it.transcript].reverse().find((t) => t.role === 'assistant')
  const demo = [...it.transcript].reverse().find((t) => t.role === 'assistant' && t.demo)?.demo
  const fixes = it.transcript.flatMap((t) => t.corrected).map((c) => `  - engine corrected ${c.field}: ${c.model} -> ${c.engine}`)
  return [
    `- **${it.id}** ${it.cleared ? '(cleared)' : '(still open)'}: ${it.entities.map((e) => e.label).join('; ') || 'free mark'}`,
    `  - screenshot: ${it.screenshot}`,
    ...questions,
    `  - final answer: ${last ? last.text.replace(/\n+/g, ' ') : '(none)'}`,
    ...(demo ? [`  - accepted demo: ${JSON.stringify(demo)}`] : []),
    ...fixes,
  ].join('\n')
}

export function briefMarkdown(log: PlayLog): string {
  const head = `# Tutorial brief: play-through ${log.id}\n\nSeed ${String(log.seed)}, ${log.length === 'east' ? 'East-only' : 'hanchan'}, started ${log.startedAt}. ` +
    `${String(log.items.length)} marked items, ${String(log.items.filter((i) => !i.cleared).length)} still open.\n`
  if (log.items.length === 0) return `${head}\nNo confusion items: nothing was marked in this play-through.\n`
  const sections = ORDER.map((topic) => {
    const items = log.items.filter((i) => i.topics.includes(topic))
    return items.length === 0 ? '' : `\n## ${topic}\n\n${items.map(itemBlock).join('\n')}\n`
  })
  return head + sections.join('')
}
