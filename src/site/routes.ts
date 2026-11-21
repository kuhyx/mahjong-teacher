// Route table: the single source for sitemap, llms.txt, ai-catalog and the
// markdown mirrors (agent-ready-site). One page today: the game itself.

export const ORIGIN = 'https://mahjong.kuhy.duckdns.org'
export const NAME = 'Mahjong Teacher'
export const SUMMARY = 'A browser Riichi mahjong game you learn by playing: freeze the table, mark any tile, call or score, and ask a question about it.'

export interface Route {
  path: string
  title: string
  description: string
  markdown: () => string
}

export const ROUTES: Route[] = [
  {
    path: '/',
    title: NAME,
    description: SUMMARY,
    markdown: () => `# ${NAME}

${SUMMARY}

## What it is

- A full game of Riichi (Japanese) mahjong against three easy computer opponents: East-only or a full hanchan (East and South rounds).
- Tiles are drawn as vector art with a small corner index (for example 5p = five of dots) so dots and bamboo are easy to tell apart.
- The pencil button freezes the table. Draw a rectangle, arrow, circle, pen stroke or text note, or tap any tile, meld, discard, score or the dora indicator, then ask a question in English or Polish.
- Answers come from the owner's own Claude plan through a private worker; asking needs the owner's Google sign-in.
- Every question thread is saved with the marked screenshot, transcript and game state until the player says "ok that is clear".

## Rules used

Riichi rules without red fives: yaku required to win, fu and han scoring with mangan and higher limits, riichi, furiten, chi/pon/kan, dora, ura dora and kan dora, honba and riichi sticks, exhaustive draws with tenpai payments.
`,
  },
]
